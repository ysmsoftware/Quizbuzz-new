# LIVE CONTEST MODULE — NAT GATEWAY
#
# WHY THIS EXISTS:
# Quiz EC2s live in PRIVATE subnets (no public IP, never directly reachable
# from the internet — all inbound traffic comes through the ALB only).
# But they still need OUTBOUND internet access to:
#   - Pull Docker images from ghcr.io (GitHub Container Registry)
#   - Call AWS APIs: SSM (read secrets), CloudWatch (logs), S3 (certificates)
#
# A NAT Gateway is AWS's managed solution for "private subnet needs outbound
# internet, but must never accept unsolicited inbound connections."
#
# WHY NOT REUSE THE EXISTING NAT INSTANCE (t3.nano, used in idle mode)?
# The plan calls for a managed NAT Gateway during live mode instead of the
# cheaper NAT Instance, because:
#   - NAT Gateway is fully managed (no patching, no single point of failure
#     from an EC2 crashing) and scales automatically to whatever throughput
#     10,000 WebSocket connections' worth of EC2s need.
#   - NAT Instance (t3.nano) has limited network throughput — would become
#     a bottleneck exactly when you can least afford one (live contest).
# Since this whole module only exists for ~24h windows, the NAT Gateway's
# higher hourly cost ($0.045/hr + data processing) is negligible versus the
# t3.medium fleet cost, and the reliability tradeoff is worth it.
#
# IMPORTANT — THIS DOES NOT REPLACE THE IDLE-MODE NAT INSTANCE:
# The idle-mode NAT Instance (in the networking module, used for the admin
# EC2's outbound traffic) is untouched by this module. This NAT Gateway is
# ADDITIONAL infrastructure that exists only alongside the live_contest
# module, routing ONLY the quiz fleet's private subnets.

# Elastic IP for the NAT Gateway. NAT Gateways require their own static IP
# to present a consistent source address for outbound traffic.
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "quizbuzz-live-nat-eip" }
}

# The NAT Gateway itself MUST live in a PUBLIC subnet (it needs a route to
# the Internet Gateway), even though it serves PRIVATE subnet traffic.
# This is a common point of confusion: NAT Gateway placement is about
# where IT sits, not where the traffic it serves originates.
resource "aws_nat_gateway" "live" {
  allocation_id = aws_eip.nat.id
  subnet_id     = var.public_subnets[0]
  tags          = { Name = "quizbuzz-live-nat-gw" }

  # Terraform requires the EIP and IGW to exist before NAT GW creation,
  # which is implicitly handled by the EIP resource dependency above.
  # If you see "InvalidSubnetID" errors, it almost always means the
  # public subnet's route table isn't actually pointed at an Internet
  # Gateway — verify that in the networking module first.
}

# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC ROUTE TO NAT GATEWAY — ATTACHED TO QUIZ PRIVATE ROUTE TABLE
#
# These subnets (var.quiz_private_subnets) are associated with a dedicated route
# table created in the networking module. When this live_contest module is active,
# we dynamically add a 0.0.0.0/0 route pointing to the NAT Gateway.
# When this module is destroyed (idle mode), the route is deleted, returning the
# quiz subnets to a completely isolated state.
#
# CRITICALLY: RDS lives in a DIFFERENT set of subnets entirely, so it is
# never affected by this route, in idle mode or live mode.
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_route" "quiz_nat" {
  route_table_id         = var.quiz_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.live.id
}

# The association is already handled in the networking module.


output "nat_gateway_id" {
  value       = aws_nat_gateway.live.id
  description = "NAT Gateway ID — useful for debugging outbound connectivity issues from quiz EC2s"
}

output "nat_eip" {
  value       = aws_eip.nat.public_ip
  description = "NAT Gateway's public IP — this is the source IP quiz EC2s' outbound traffic will appear to come from"
}
