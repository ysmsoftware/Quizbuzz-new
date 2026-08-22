aws_region            = "ap-south-1"
mode                  = "idle"
expected_participants = 1000
domain_name           = "ysmquizbuzz.com"
alert_email           = "austinmakasare22@gmail.com"
key_pair_name         = "quizbuzz-key"
github_org            = "ysmsoftware"

# Ops dashboard VPS — allowed direct Postgres access on the RDS security
# group. See variables.tf for why this must live here and never be added
# by hand in the AWS Console.
ops_vps_ip            = "94.249.213.146/32"
