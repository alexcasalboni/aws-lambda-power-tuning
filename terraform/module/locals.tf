locals {
  defaultPowerValues = "[128,256,512,1024,1536,3008]"
  minRAM             = 128
  baseCosts          = jsonencode({"x86_64": {"ap-east-1":2.9e-9,"af-south-1":2.8e-9,"me-south-1":2.6e-9,"eu-south-1":2.4e-9,"ap-northeast-3":2.7e-9,"default":2.1e-9}, "arm64": {"default":1.7e-9}})
  sfCosts            = jsonencode({ "default" : 0.000025, "us-gov-west-1" : 0.00003, "ap-northeast-2" : 0.0000271, "eu-south-1" : 0.00002625, "af-south-1" : 0.00002975, "us-west-1" : 0.0000279, "eu-west-3" : 0.0000297, "ap-east-1" : 0.0000275, "me-south-1" : 0.0000275, "ap-south-1" : 0.0000285, "us-gov-east-1" : 0.00003, "sa-east-1" : 0.0000375 })
  visualizationURL   = "https://lambda-power-tuning.show/"

  role_path = var.role_path_override != "" ? var.role_path_override : "/${var.lambda_function_prefix}/"

  state_machine = templatefile(
    "${path.module}/json_files/state_machine.json",
    {
      initializerArn = aws_lambda_function.initializer.arn,
      executorArn    = aws_lambda_function.executor.arn,
      cleanerArn     = aws_lambda_function.cleaner.arn,
      analyzerArn    = aws_lambda_function.analyzer.arn,
      optimizerArn   = aws_lambda_function.optimizer.arn
    }
  )

  cleaner_template = templatefile(
    "${path.module}/json_files/cleaner.json",
    {
      account_id = var.account_id
    }
  )

  executor_template = templatefile(
    "${path.module}/json_files/executor.json",
    {
      account_id = var.account_id
    }
  )

  initializer_template = templatefile(
    "${path.module}/json_files/initializer.json",
    {
      account_id = var.account_id
    }
  )

  optimizer_template = templatefile(
    "${path.module}/json_files/optimizer.json",
    {
      account_id = var.account_id
    }
  )
}
