# STORAGE MODULE
#
# DELETION PROTECTION — mirrors the RDS module's deletion_protection = true.
# S3 buckets have no AWS-level "deletion_protection" flag like RDS does, so
# we use Terraform's own lifecycle.prevent_destroy instead. This makes
# `terraform destroy` (or any plan that would remove this resource) fail
# with an error rather than silently deleting the bucket and everything
# inside it (certificates, assets — irreplaceable, unlike compute).
#
# HOW THIS BEHAVES ON destroy/apply CYCLES (idle <-> live mode switching):
#   - terraform destroy / apply -var="mode=idle" after "mode=live":
#     this module is NEVER targeted by the live/idle switch (it has no
#     count or is_live conditional), so it is untouched on every normal
#     apply regardless of mode. prevent_destroy is a safety net for the
#     rare case someone runs `terraform destroy` against the whole stack
#     or removes this module block from main.tf by mistake.
#   - Because the bucket name (quizbuzz-assets-prod) is fixed and S3
#     bucket names are globally unique + immutable, as long as this
#     resource stays in Terraform state, `terraform apply` will always
#     detect the existing bucket and reuse it — it will NEVER attempt to
#     recreate it unless you change an immutable argument (e.g. `bucket`)
#     or someone deletes it out-of-band and you run `terraform import`
#     again.

resource "aws_s3_bucket" "main" {
  bucket = "quizbuzz-assets-prod"
  force_destroy = false
  tags = { Name = "quizbuzz-assets", Purpose = "certificates-and-assets" }

  lifecycle {
    prevent_destroy = true
  }
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
