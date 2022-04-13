
variable "aws_region" {}
variable "account_id" {}

variable "lambda_function_prefix" {
  default = "lambda_power_tuning"
}

variable "permissions_boundary" {
  default     = null
  description = "ARN of the policy that is used to set the permissions boundary for the role."
}
