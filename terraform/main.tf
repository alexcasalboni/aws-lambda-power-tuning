module "power_tuning" {
  source     = "./module"
  account_id = data.aws_caller_identity.current.account_id
}