module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.21.0"
  name = local.name
  cidr = var.vpc_cidr
  azs = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets = [cidrsubnet(var.vpc_cidr, 4, 0), cidrsubnet(var.vpc_cidr, 4, 1)]
  private_subnets = [cidrsubnet(var.vpc_cidr, 4, 4), cidrsubnet(var.vpc_cidr, 4, 5)]
  database_subnets = [cidrsubnet(var.vpc_cidr, 4, 8), cidrsubnet(var.vpc_cidr, 4, 9)]
  enable_nat_gateway = true
  enable_dns_hostnames = true
  tags = local.tags
}
data "aws_caller_identity" "current" {}
resource "aws_kms_key" "data" { description = "${local.name} encryption"
  enable_key_rotation = true
  tags = local.tags }
resource "aws_security_group" "data" { name = "${local.name}-data"
  vpc_id = module.vpc.vpc_id
  tags = local.tags }
resource "aws_security_group_rule" "postgres" { for_each = toset(var.allowed_app_security_group_ids)
  type = "ingress"
  from_port = 5432
  to_port = 5432
  protocol = "tcp"
  source_security_group_id = each.value
  security_group_id = aws_security_group.data.id }
resource "aws_security_group_rule" "redis" { for_each = toset(var.allowed_app_security_group_ids)
  type = "ingress"
  from_port = 6379
  to_port = 6379
  protocol = "tcp"
  source_security_group_id = each.value
  security_group_id = aws_security_group.data.id }

module "database" {
  source = "terraform-aws-modules/rds/aws"
  version = "6.12.0"
  identifier = local.name
  engine = "postgres"
  engine_version = "16"
  family = "postgres16"
  instance_class = var.database_instance_class
  allocated_storage = 50
  max_allocated_storage = 500
  db_name = var.database_name
  username = var.database_username
  password = var.database_password
  port = 5432
  multi_az = true
  storage_encrypted = true
  kms_key_id = aws_kms_key.data.arn
  db_subnet_group_name = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.data.id]
  backup_retention_period = 14
  deletion_protection = true
  skip_final_snapshot = false
  performance_insights_enabled = true
  tags = local.tags
}

resource "aws_elasticache_subnet_group" "main" { name = local.name
  subnet_ids = module.vpc.private_subnets }
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = local.name
  description = "AI-MARKS queue"
  node_type = "cache.t4g.small"
  num_cache_clusters = 2
  port = 6379
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = true
  snapshot_retention_limit = 7
  tags = local.tags
}

resource "aws_s3_bucket" "files" { bucket = "${local.name}-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
  tags = local.tags }
resource "aws_s3_bucket_public_access_block" "files" { bucket = aws_s3_bucket.files.id
  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true }
resource "aws_s3_bucket_server_side_encryption_configuration" "files" { bucket = aws_s3_bucket.files.id
  rule { apply_server_side_encryption_by_default { kms_master_key_id = aws_kms_key.data.arn
      sse_algorithm = "aws:kms" } } }
resource "aws_s3_bucket_versioning" "files" { bucket = aws_s3_bucket.files.id
  versioning_configuration { status = "Enabled" } }

resource "aws_ecr_repository" "services" { for_each = toset(["frontend", "backend", "ai-service"])
  name = "${local.name}/${each.value}"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "KMS"
    kms_key = aws_kms_key.data.arn }
  tags = local.tags }
resource "aws_ecs_cluster" "main" { name = local.name
  setting { name = "containerInsights"
    value = "enabled" }
  tags = local.tags }
resource "aws_cloudwatch_log_group" "services" { for_each = toset(["frontend", "backend", "ai-service", "ai-worker"])
  name = "/ecs/${local.name}/${each.value}"
  retention_in_days = 30
  kms_key_id = aws_kms_key.data.arn
  tags = local.tags }
