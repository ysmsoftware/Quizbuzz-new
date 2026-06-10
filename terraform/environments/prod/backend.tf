
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      # The ~> means "5.x but not 6.0" — prevents breaking changes from major upgrades
    }
  }

  backend "s3" {
    bucket         = "quizbuzz-terraform-state"
    key            = "prod/terraform.tfstate"  # path inside the bucket
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "quizbuzz-tf-locks"
  }
}



provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "QuizBuzz"
      Environment = "prod"
      ManagedBy   = "Terraform"
      # This tag on every resource means you can filter in AWS Console:
      # "Show me everything managed by Terraform for QuizBuzz"
    }
  }
}
