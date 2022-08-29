terraform {
  backend "s3" {
    key            = "prod/redstone/ecs-cache-layer.tfstate"
    bucket         = "redstone-terraform-state-prod"
    dynamodb_table = "redstone-terraform-state-lock"
    region         = "us-east-1"
  }
}
