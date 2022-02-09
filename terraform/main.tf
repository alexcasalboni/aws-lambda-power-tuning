module "power_tuning" {
  source     = "./module"
  aws_region = var.aws_region
  account_id = var.account_id
}