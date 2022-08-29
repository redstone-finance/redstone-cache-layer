variable "alb-name" {
  type = string
}
variable "env" {
  type = string
}
variable "max-capacity" {
  default = 15
}
variable "min-capacity" {
  default = 3
}
variable "service-name" {
  default = "redstone-cache-layer"
}
variable "vpc-id" {}
variable "subnet-ids" {
  type = list(string)
}
variable "image-repo" {
  default = "public.ecr.aws/g4b4d3a5/cache-layer-test"
#  default = "public.ecr.aws/y7v2w8b2/redstone-cache-layer"
}
variable "image-tag" {
  default = "latest"
}
variable "cluster-arn" {}

variable "mongo-db-url-arn" {
  description = "Secret or ssm parameter ARN"
}
variable "mongo-db-user-arn" {
  description = "Secret or ssm parameter ARN"
}
variable "mongo-db-password-arn" {
  description = "Secret or ssm parameter ARN"
}
variable "container-port" {
  type = number
  default = 9000
}
