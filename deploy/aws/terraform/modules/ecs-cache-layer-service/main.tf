resource "aws_ecs_service" "this" {
  name        = var.service-name
  cluster     = var.cluster-arn
  launch_type = "EC2"

  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = 1
  health_check_grace_period_seconds = 6

  network_configuration {
    subnets = var.subnet-ids
    security_groups = [
      aws_security_group.this.id
    ]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.service-name
    container_port   = var.container-port
  }
}
resource "aws_ecs_task_definition" "this" {
  family                = var.service-name
  execution_role_arn = aws_iam_role.task-execution-role.arn
  network_mode = "awsvpc"
  container_definitions = jsonencode([
    {
      name : var.service-name
      image : "${var.image-repo}:${var.image-tag}"
      essential               = true
      memory                  = 1024
      RequiresCompatibilities = ["EC2"]
      portMappings : [
        {
          hostPort : var.container-port
          containerPort : var.container-port,
          protocol : "tcp"
        }
      ]
      containerDefinitions : [
        {
          image: "${var.image-repo}:${var.image-tag}"
        }
      ]
      secrets : [
        {
          name: "MONGO_DB_URL",
          valueFrom: var.mongo-db-url-arn,
        },
        {
          name: "MONGO_USER",
          valueFrom: var.mongo-db-user-arn,
        },
        {
          name: "MONGO_PASSWORD",
          valueFrom: var.mongo-db-password-arn,
        }
      ]
      logConfiguration : {
        logDriver : "awslogs",
        options : {
          "awslogs-group" : aws_cloudwatch_log_group.task-logs.name,
          "awslogs-region" : data.aws_region.current.name,
          "awslogs-stream-prefix" : "ecs"
        }
      },
    }
  ])
}

resource "aws_cloudwatch_log_group" "task-logs" {
  name = "/ecs/redstone/ecs/${var.service-name}"
}
resource "aws_iam_role_policy_attachment" "ecs-task-execution-role-default-policy-attachment" {
  role       = aws_iam_role.task-execution-role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_lb" "alb" {
  name = var.alb-name
}

resource "aws_lb_target_group" "this" {
  name_prefix = substr(var.service-name, 0, 5)
  port        = var.container-port
  vpc_id      = var.vpc-id
  target_type = "ip"
  protocol    = "HTTP"
  health_check {
    enabled = true
    healthy_threshold = 2
    path = "/configs/tokens"

  }
}

resource "aws_lb_listener" "nlb_listener" {
  load_balancer_arn = data.aws_lb.alb.id
  port              = 443
  protocol          = "HTTP"
  default_action {
    target_group_arn = aws_lb_target_group.this.id
    type             = "forward"
  }
}

data "aws_region" "current" {}

resource "aws_iam_role" "task-execution-role" {
  name               = "${var.service-name}-task-execution-role"
  assume_role_policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
POLICY
  inline_policy {
    name = "allowSecretsAccess"
    policy = <<POLICY
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "ssm:GetParameters",
            "Resource": [
                "${var.mongo-db-url-arn}",
                "${var.mongo-db-user-arn}",
                "${var.mongo-db-password-arn}"
            ]
        }
    ]
}
POLICY
  }
}

locals {
  sg-name = "ecs-service-${var.service-name}-${var.env}"
}
resource "aws_security_group" "this" {
  name = local.sg-name
  vpc_id = var.vpc-id
  ingress {
    protocol  = "TCP"
    from_port = var.container-port
    to_port   = var.container-port
    security_groups = data.aws_lb.alb.security_groups
  }
  egress {
    from_port = 0
    protocol  = -1
    to_port   = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name: local.sg-name
  }
}

#resource "aws_iam_role_policy_attachment" "service-role-attachment" {
#  role       = aws_iam_role.service-role.name
#  policy_arn = "arn:aws:iam::aws:policy/aws-service-role/AmazonECSServiceRolePolicy"
#}
