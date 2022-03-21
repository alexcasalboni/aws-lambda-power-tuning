resource "aws_iam_role" "analyzer_role" {
  name               = "${var.lambda_function_prefix}-analyzer_role"
  path               = "/${var.lambda_function_prefix}/"
  assume_role_policy = file("${path.module}/json_files/lambda.json")
}

resource "aws_iam_role" "optimizer_role" {
  name               = "${var.lambda_function_prefix}-optimizer_role"
  path               = "/${var.lambda_function_prefix}/"
  assume_role_policy = file("${path.module}/json_files/lambda.json")
}

resource "aws_iam_role" "executor_role" {
  name               = "${var.lambda_function_prefix}-executor_role"
  path               = "/${var.lambda_function_prefix}/"
  assume_role_policy = file("${path.module}/json_files/lambda.json")
}

resource "aws_iam_role" "initializer_role" {
  name               = "${var.lambda_function_prefix}-initializer_role"
  path               = "/${var.lambda_function_prefix}/"
  assume_role_policy = file("${path.module}/json_files/lambda.json")
}

resource "aws_iam_role" "cleaner_role" {
  name               = "${var.lambda_function_prefix}-cleaner_role"
  path               = "/${var.lambda_function_prefix}/"
  assume_role_policy = file("${path.module}/json_files/lambda.json")
}

resource "aws_iam_role" "sfn_role" {
  name               = "${var.lambda_function_prefix}-sfn_role"
  path               = "/${var.lambda_function_prefix}/"
  assume_role_policy = file("${path.module}/json_files/sfn.json")
}

