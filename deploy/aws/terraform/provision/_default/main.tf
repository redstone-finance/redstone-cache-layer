provider "aws" {
  region = var.region
  default_tags {
    tags = {
      env         = var.env
      service     = "ecs-cache-layer"
      provisioner = "terraform"
    }
  }
}
module "ecs-cache-layer" {
  source                = "../../modules/ecs-cache-layer-service"
  env                   = var.env
  alb-name              = data.aws_ssm_parameter.alb-name.value
  cluster-arn           = data.aws_ssm_parameter.cluster-arn.value
  vpc-id                = data.aws_ssm_parameter.vpc-id.value
  subnet-ids            = data.aws_subnets.private.ids
  mongo-db-url-arn      = data.aws_ssm_parameter.atlas-endpoint.arn
  mongo-db-user-arn     = data.aws_ssm_parameter.atlas-username.arn
  mongo-db-password-arn = data.aws_ssm_parameter.atlas-password.arn
}
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_ssm_parameter.vpc-id.value]
  }
  tags = {
    Tier = "Private"
  }
}
data "aws_ssm_parameter" "cluster-arn" {
  name = "/${var.env}/redstone/infrastructure/ecs-cluster-arn"
}
data "aws_ssm_parameter" "vpc-id" {
  name = "/${var.env}/redstone/infrastructure/vpc-id"
}
data "aws_ssm_parameter" "alb-name" {
  name = "/${var.env}/redstone/infrastructure/alb-name"
}
data "aws_ssm_parameter" "atlas-endpoint" {
  name = "/${var.env}/redstone/infrastructure/atlas/cluster-endpoint"
}
data "aws_ssm_parameter" "atlas-username" {
  name = "/${var.env}/redstone/infrastructure/atlas/admin-username"
}
data "aws_ssm_parameter" "atlas-password" {
  name = "/${var.env}/redstone/infrastructure/atlas/admin-password"
}
