# Lambda Power Tuning Terraform native

## Overview
This was created for those that may not be in a position to use Cloudformation. Some may not have access, for others it may not be an approved service within their company. Either way, this was our situation.

## Before you start

Modify the variables to your desired region, and to target the correct AWS Account

```
variable "aws_region" {
  default = "eu-west-1"
}

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

## Deploy multiple to multiple accounts/regions
Copy the module in main.tf, and give it a new module name e.g.

```
module "power_tuning" {
  source = "./module"
  aws_region = var.aws_region
  account_id = var.account_id
}

module "power_tuning_2" {
  source = "./module"
  aws_region = var.aws_region_2
  account_id = var.account_id_2
}
```

If you're planning on deploying many, I'd suggest keeping your statefile lightweight, and plans/applies faster by using a folder strategy by either account or region.

## Versions tested
- 0.13.3
- 1.0.11

This should provide good coverage between those versions, but if there's any problems please raise an issue. 
