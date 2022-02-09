
resource "aws_sfn_state_machine" "state-machine" {
  name     = var.lambda_function_prefix
  role_arn = aws_iam_role.sfn_role.arn

  definition = local.state_machine
}