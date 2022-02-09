
variable "aws_region" {
  default = "eu-west-1"
}

# variable "default_env_vars" {
#   type = map
#   default = {
#     defaultPowerValues = "[128,256,512,1024,1536,3008]",
#     baseCosts = jsonencode({"ap-east-1":2.9e-9,"af-south-1":2.8e-9,"me-south-1":2.6e-9,"eu-south-1":2.4e-9,"ap-northeast-3":2.7e-9,"default":2.1e-9}),
#     sfCosts = jsonencode({"default": 0.000025,"us-gov-west-1": 0.00003,"ap-northeast-2": 0.0000271,"eu-south-1": 0.00002625,"af-south-1": 0.00002975,"us-west-1": 0.0000279,"eu-west-3": 0.0000297,"ap-east-1": 0.0000275,"me-south-1": 0.0000275,"ap-south-1": 0.0000285,"us-gov-east-1": 0.00003,"sa-east-1": 0.0000375}),
#     visualizationURL = "https://lambda-power-tuning.show/"
#   }
# }

variable "lambda_function_prefix" {
  default = "lambda_power_tuning"
}

variable "account_id" {}