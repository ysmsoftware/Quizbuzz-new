variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "AWS region for all resources. ap-south-1 = Mumbai."
}

variable "mode" {
  type        = string
  default     = "idle"
  description = <<-EOT
    Infrastructure mode. Controls which resources are active:
    - "idle": Only the admin EC2, RDS, S3. For admin work, registration, results.
    - "live": Everything above + ALB + ElastiCache + quiz ASG. For live contests.
    
    Switching from idle to live: terraform apply -var="mode=live"
    Switching back:              terraform apply -var="mode=idle"
    (The live resources are destroyed when you switch back, saving cost.)
  EOT

  validation {
    condition     = contains(["idle", "live"], var.mode)
    error_message = "mode must be either 'idle' or 'live'."
  }
}

variable "expected_participants" {
  type        = number
  default     = 1000
  description = <<-EOT
    How many concurrent users you expect for the upcoming contest.
    Used to calculate how many c6i.large quiz instances to spin up in live mode.
    Formula: ceil(participants / 1000), capped at 10.
    Examples: 1000 → 1 instance, 3000 → 3 instances, 10000 → 10 instances.
  EOT
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = <<-EOT
    Docker image tag to deploy. In production, this should be a git SHA
    (e.g. "a3f8c2d") so you know exactly which code is running.
    Your CI/CD pipeline updates this via SSM, not by changing this variable.
    This variable is used for the initial deploy and manual overrides.
  EOT
}

variable "domain_name" {
  type        = string
  default     = "ysminfosolution.com"
  description = "Your root domain. Used to build the full subdomain FQDN."
}

variable "api_subdomain" {
  type        = string
  default     = "quiz"
  description = <<-EOT
    The subdomain for your app. Combined with domain_name to get:
    quiz.ysminfosolution.com
    This is the URL your users and your CI/CD health checks will hit.
  EOT
}

variable "alert_email" {
  type        = string
  default     = "austinmakasare22@gmail.com"
  description = <<-EOT
    Email address that receives CloudWatch alarm notifications.
    Things like: EC2 CPU above 80%, RDS latency spike, etc.
    Change this to your actual monitoring email.
  EOT
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = <<-EOT
    Password for the RDS PostgreSQL master user (quizbuzz_admin).
    NEVER put this in terraform.tfvars or commit it to git.
    
    How to pass it safely:
    Option A — Environment variable (recommended for CI/CD):
      export TF_VAR_db_password="YourStrongPassword123!"
      terraform apply
    
    Option B — Command line (ok for local use, not CI/CD):
      terraform apply -var="db_password=YourStrongPassword123!"
    
    Requirements: Min 8 chars, mix of upper/lower/numbers/symbols.
    Save this password in a password manager — you need it for DATABASE_URL.
  EOT
}

variable "your_ip" {
  type        = string
  default     = "0.0.0.0/0"
  description = <<-EOT
    Your developer IP address for SSH access to the EC2 instance.
    Format: "1.2.3.4/32" (the /32 means exactly that one IP).
    
    To find your IP: curl https://checkip.amazonaws.com
    
    Using 0.0.0.0/0 (the default) allows SSH from anywhere, which is
    less secure but acceptable if you have a strong SSH key.
    For better security, replace with your actual IP.
  EOT
}

variable "key_pair_name" {
  type        = string
  default     = "quizbuzz-key"
  description = <<-EOT
    Name of the AWS key pair for SSH access to the EC2 instance.
    
    You must create this BEFORE running terraform apply:
    1. Go to AWS Console → EC2 → Key Pairs → Create key pair
    2. Name it "quizbuzz-key"
    3. Download the .pem file and save it at ~/.ssh/quizbuzz-key.pem
    4. Run: chmod 400 ~/.ssh/quizbuzz-key.pem
    
    Then SSH with: ssh -i ~/.ssh/quizbuzz-key.pem ec2-user@<elastic-ip>
  EOT
}

variable "github_org" {
  type        = string
  default     = "ysmsoftware"
  description = <<-EOT
    Your GitHub username or organization name. Used to pull Docker images
    from GHCR (GitHub Container Registry).
    Example: if your images are at ghcr.io/myusername/quizbuzz-backend
    then this value should be "myusername".
  EOT
}
