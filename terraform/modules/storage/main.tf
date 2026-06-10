# STORAGE MODULE

resource "aws_s3_bucket" "main" {
  bucket = "quizbuzz-assets-prod"
  tags = { Name = "quizbuzz-assets", Purpose = "certificates-and-assets" }
}

# Versioning
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "expire-old-certificates"
    status = "Enabled"

    filter {
      prefix = "certificates/"
    }

    # Delete the current version after 365 days
    expiration {
      days = 365
    }

    # Delete old non-current versions after 30 days
    # (these are created by versioning when a file is re-uploaded)
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

output "bucket_name" {
  value       = aws_s3_bucket.main.id
  description = "S3 bucket name — needed for S3_BUCKET env var in your containers"
}

output "bucket_arn" {
  value       = aws_s3_bucket.main.arn
  description = "S3 bucket ARN — needed for the EC2 IAM policy to allow S3 access"
}
