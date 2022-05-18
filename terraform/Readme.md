# Deploy with Terraform natively

## Overview
This deployment option is intended for those who may not be in a position to use AWS Cloudformation, in cases where you do not have access or when CloudFormation is not an approved service within your company.

## Before you start

Modify the variables to target the correct AWS Account.

```
variable "account_id" {
  default = "123456789101"
}
```

## Usage
```
terraform init
terraform plan
terraform apply
```

## Deploy to multiple accounts/regions
Copy the module in `main.tf` and give it a new module name. For example:

```
module "power_tuning" {
  source = "./module"
  account_id = var.account_id
}

module "power_tuning_2" {
  source = "./module"
  account_id = var.account_id_2
}
```

If you're planning on deploying many, it's recommended to adopt a folder strategy by either account or region. This will make sure you keep your statefile lightweight and plans/applies faster.

## Versions tested
- 0.13.3
- 1.0.11

This should provide good coverage between those versions. If there's any problems, please raise an issue.
