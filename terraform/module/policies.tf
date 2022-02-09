data "aws_iam_policy" "analyzer_policy" {
  name = "AWSLambdaExecute"
}

resource "aws_iam_policy_attachment" "execute-attach" {
  name       = "execute-attachment"
  roles      = [aws_iam_role.analyzer_role.name, aws_iam_role.optimizer_role.name, aws_iam_role.executor_role.name, aws_iam_role.cleaner_role.name, aws_iam_role.initializer_role.name]
  policy_arn = data.aws_iam_policy.analyzer_policy.arn
}

resource "aws_iam_policy" "executor_policy" {
  name        = "${var.lambda_function_prefix}_executor-policy"
  description = "Lambda power tuning policy - Executor - Terraform"

  policy = local.executor_template
}

resource "aws_iam_policy_attachment" "executor-attach" {
  name       = "executor-attachment"
  roles      = [aws_iam_role.executor_role.name]
  policy_arn = aws_iam_policy.executor_policy.arn
}

resource "aws_iam_policy" "initializer_policy" {
  name        = "${var.lambda_function_prefix}_initializer-policy"
  description = "Lambda power tuning policy - Initializer - Terraform"

  policy = local.initializer_template
}

resource "aws_iam_policy_attachment" "initializer-attach" {
  name       = "initializer-attachment"
  roles      = [aws_iam_role.initializer_role.name]
  policy_arn = aws_iam_policy.initializer_policy.arn
}

resource "aws_iam_policy" "cleaner_policy" {
  name        = "${var.lambda_function_prefix}_cleaner-policy"
  description = "Lambda power tuning policy - Cleaner - Terraform"

  policy = local.cleaner_template
}

resource "aws_iam_policy_attachment" "cleaner-attach" {
  name       = "cleaner-attachment"
  roles      = [aws_iam_role.cleaner_role.name]
  policy_arn = aws_iam_policy.cleaner_policy.arn
}

resource "aws_iam_policy" "optimizer_policy" {
  name        = "${var.lambda_function_prefix}_optimizer-policy"
  description = "Lambda power tuning policy - Optimizer - Terraform"

  policy = local.optimizer_template
}

resource "aws_iam_policy_attachment" "optimizer-attach" {
  name       = "optimizer-attachment"
  roles      = [aws_iam_role.optimizer_role.name]
  policy_arn = aws_iam_policy.optimizer_policy.arn
}


data "aws_iam_policy" "sfn_policy" {
  name = "AWSLambdaRole"
}

resource "aws_iam_policy_attachment" "sfn-attach" {
  name       = "sfn-attachment"
  roles      = [aws_iam_role.sfn_role.name]
  policy_arn = data.aws_iam_policy.sfn_policy.arn
}