# Deploy with Terraform natively

## Overview
This deployment option is intended for those who may not be in a position to use AWS Cloudformation, in cases where you do not have access or when CloudFormation is not an approved service within your company.

The Terraform code is contained in the `terraform` directory of this project.

You can either clone this repository and run the terraform command from within the `terraform` directory.
Another solution is to reference the git repository directly and include the module in another Terraform project.

## Local repository

### Before you start

Modify the `variables.tf` file with your target AWS Account and region.
```
variable "account_id" {
  default = "123456789101"
}
variable "aws_region" {
  default = "eu-west-1"
}
```

### Deploy the solution
```
terraform init
terraform plan
terraform apply
```

Once deployed, follow [these instructions](../README-EXECUTE.md) to run Lambda Power Tuning.

### Deploy to multiple accounts/regions

If you're planning on deploying to multiple accounts or regions, it's recommended to adopt a folder strategy by either account or region. This will make sure you keep your statefile lightweight and plans/applies faster.

### Delete the solution
Run the below command to remove all resources from your account:
```bash
terraform destroy
```
Enter 'yes' at the confirmation prompt.

## Remote repository

When using the module inside another Terraform project, you can reference the module directly from the GitHub repository.

```hcl
module "aws-lambda-power-tuning" {
  source = "git@github.com:alexcasalboni/aws-lambda-power-tuning//terraform/module"

  account_id = data.aws_caller_identity.current.account_id
}
```

## Versions tested
- 0.13.3
- 1.0.11
- 1.7.3

This should provide good coverage between those versions. If there's any problems, please raise an issue.
