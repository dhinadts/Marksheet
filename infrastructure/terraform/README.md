# Terraform

# AWS production foundation

This stack provisions a multi-AZ VPC, encrypted/deletion-protected PostgreSQL, encrypted
Redis replication, private versioned S3, KMS, scanning-enabled ECR repositories, an ECS
cluster, and encrypted CloudWatch log groups. Configure remote state from
`backend.hcl.example`; provide database credentials only through CI secrets or a secure
local environment. Application ECS task/service definitions are environment-specific and
must reference immutable image digests, private subnets, least-privilege task roles, and
Secrets Manager/SSM values. Kubernetes is not required.
