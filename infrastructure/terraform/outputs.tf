output "vpc_id" { value = module.vpc.vpc_id }
output "private_subnet_ids" { value = module.vpc.private_subnets }
output "ecs_cluster_arn" { value = aws_ecs_cluster.main.arn }
output "ecr_repository_urls" { value = { for key, repo in aws_ecr_repository.services : key => repo.repository_url } }
output "database_endpoint" { value = module.database.db_instance_endpoint
  sensitive = true }
output "redis_endpoint" { value = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true }
output "file_bucket" { value = aws_s3_bucket.files.id }
