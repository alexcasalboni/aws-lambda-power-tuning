variable "account_id" {
  description = "Your AWS account id."
}

variable "lambda_function_prefix" {
  default = "lambda_power_tuning"
}

variable "role_path_prefix" {
  default     = null
  type        = string
  description = "If you want to have a role path different from the lambda_function_prefix, use this variable."
}

variable "permissions_boundary" {
  default     = null
  description = "ARN of the policy that is used to set the permissions boundary for the role."
}
