# IAM Permissions Guide for Lambda Power Tuning

This guide explains how to configure IAM permissions for AWS Lambda Power Tuning with the principle of least privilege.

## Table of Contents

- [Overview](#overview)
- [Default Permissions](#default-permissions)
- [Least Privilege Configuration](#least-privilege-configuration)
- [Common Issues & Solutions](#common-issues--solutions)
- [Permission Reference](#permission-reference)

## Overview

By default, the Lambda Power Tuning state machine uses `*` as the `lambdaResource` parameter, allowing it to invoke any Lambda function in your account. While this is convenient for testing, it's recommended to restrict permissions to specific functions or prefixes in production environments.

## Default Permissions

When you deploy with the default `lambdaResource = "*"`, the following IAM permissions are granted:

| Function | Permissions | Resource |
|----------|-------------|----------|
| Initializer | `lambda:GetFunctionConfiguration` | `*` |
| Publisher | `lambda:GetAlias`, `lambda:GetFunctionConfiguration`, `lambda:PublishVersion`, `lambda:UpdateFunctionConfiguration`, `lambda:CreateAlias`, `lambda:UpdateAlias` | `*` |
| Executor | `lambda:InvokeFunction`, `lambda:GetFunctionConfiguration` | `*` |
| Cleaner | `lambda:GetAlias`, `lambda:DeleteAlias`, `lambda:DeleteFunction` | `*` |
| Optimizer | `lambda:GetAlias`, `lambda:PublishVersion`, `lambda:UpdateFunctionConfiguration`, `lambda:GetFunctionConfiguration`, `lambda:CreateAlias`, `lambda:UpdateAlias` | `*` |

## Least Privilege Configuration

### Using Function Name Prefixes

To restrict the state machine to functions with a specific prefix (e.g., `prod-*`):

```hcl
# Terraform example
resource "aws_serverlessapplicationrepository_cloudformation_stack" "lambda-power-tuning" {
  name           = "lambda-power-tuner"
  application_id = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning"
  capabilities   = ["CAPABILITY_IAM"]

  parameters = {
    lambdaResource = "arn:aws:lambda:*:*:function:prod-*"
  }
}
```

### Using Specific Function ARNs

For even tighter security, you can specify exact function ARNs:

```hcl
parameters = {
  lambdaResource = "arn:aws:lambda:us-east-1:123456789012:function:my-specific-function"
}
```

### Same-Region Restriction

To restrict to functions within a specific region:

```hcl
parameters = {
  lambdaResource = "arn:aws:lambda:us-east-1:*:function:*"
}
```

## Common Issues & Solutions

### Issue: Initializer fails with "Access Denied" error

**Symptom**: The state machine fails at the Initializer step with an error like:
```
AccessDeniedException: User is not authorized to perform: lambda:GetFunctionConfiguration
```

**Root Cause**: When using SAR (Serverless Application Repository) deployment, the Lambda function ARN includes the `$LATEST` qualifier. Your IAM policy needs to explicitly allow actions on ARNs with this qualifier.

**Solution**: Ensure your `lambdaResource` parameter includes support for qualified ARNs:

```hcl
# ❌ This will fail with Initializer
lambdaResource = "arn:aws:lambda:us-east-1:123456789012:function:my-function"

# ✅ This will work - includes any qualifier (including $LATEST)
lambdaResource = "arn:aws:lambda:us-east-1:123456789012:function:my-function*"

# ✅ Or use wildcard for all functions in the region
lambdaResource = "arn:aws:lambda:us-east-1:123456789012:function:*"
```

### Issue: AWSLambdaExecute policy conflict with Terraform

**Symptom**: When using the AWS Terraform provider with `aws_iam_policy_attachment`, existing policies are detached.

**Root Cause**: The `aws_iam_policy_attachment` resource manages the complete set of attached policies, not additive.

**Solution**: Use `aws_iam_role_policy_attachment` instead:

```hcl
# ❌ This will detach other policies
resource "aws_iam_policy_attachment" "lambda_power_tuning" {
  name       = "lambda-power-tuning-attachment"
  roles      = [aws_iam_role.example.name]
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaExecute"
}

# ✅ This adds the policy without affecting others
resource "aws_iam_role_policy_attachment" "lambda_power_tuning" {
  role       = aws_iam_role.example.name
  policy_arn = "arn:aws:iam::aws:policy/AWSLambdaExecute"
}
```

### Issue: Cross-region invocation fails

**Symptom**: The Executor fails when trying to invoke a Lambda function in a different region.

**Root Cause**: The `lambdaResource` parameter restricts the region.

**Solution**: Either use `*` for the region or explicitly include the target region:

```hcl
# Allow all regions
lambdaResource = "arn:aws:lambda:*:*:function:my-function*"

# Or specify multiple regions
# Note: You'll need to deploy separate state machines for each region
```

## Permission Reference

### Required Permissions by Function

#### Initializer
- `lambda:GetFunctionConfiguration` - Required to read the current function configuration before creating test versions

#### Publisher
- `lambda:GetAlias` - Check if alias exists
- `lambda:GetFunctionConfiguration` - Read function configuration
- `lambda:PublishVersion` - Create new versions for testing
- `lambda:UpdateFunctionConfiguration` - Update memory configuration
- `lambda:CreateAlias` - Create aliases for each power value
- `lambda:UpdateAlias` - Update existing aliases

#### Executor
- `lambda:InvokeFunction` - Invoke the function being tuned
- `lambda:GetFunctionConfiguration` - Read function configuration

#### Cleaner
- `lambda:GetAlias` - Check aliases before deletion
- `lambda:DeleteAlias` - Remove test aliases
- `lambda:DeleteFunction` - Remove test versions (only by version/qualifier)

#### Optimizer
- Same as Publisher (when `autoOptimize` is enabled)

## Examples

### Example 1: Dev/Test Environment (Permissive)

```hcl
parameters = {
  lambdaResource = "arn:aws:lambda:us-west-2:123456789012:function:dev-*"
}
```

### Example 2: Production Environment (Strict)

```hcl
parameters = {
  lambdaResource = "arn:aws:lambda:us-east-1:123456789012:function:prod-api-*"
}
```

### Example 3: Multi-Account Setup

If you have separate accounts for dev/staging/prod, deploy separate state machines with account-specific resources:

```hcl
# Production account
parameters = {
  lambdaResource = "arn:aws:lambda:us-east-1:PROD_ACCOUNT:function:*"
}
```

## Testing Your Permissions

Before running a full power-tuning execution, you can test your IAM configuration with this AWS CLI command:

```bash
# Test if Initializer can get function configuration
aws lambda get-function-configuration \
  --function-name arn:aws:lambda:us-east-1:123456789012:function:my-function:$LATEST

# Test if you can invoke the function
aws lambda invoke \
  --function-name arn:aws:lambda:us-east-1:123456789012:function:my-function \
  --payload '{}' \
  /dev/null
```

If these commands succeed, your IAM configuration should work with Lambda Power Tuning.

---

*For more information, see the [Security section in README-ADVANCED.md](README-ADVANCED.md#security) and [deployment options](README-DEPLOY.md).*
