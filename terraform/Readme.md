# Lambda Power Tuning Terraform native

## Overview
This was created for those that may not be in a position to use Cloudformation. Some may not have access, for others it may not be an approved service within their company. Either way, this was our situation.

## Before you start

In variables.tf modify the following with your AWS account ID.

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

## Versions tested
- 0.13.3
- 1.0.11

This should provide good coverage between those versions, but if there's any problems please raise an issue. 
