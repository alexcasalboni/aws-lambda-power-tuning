
resource "aws_lambda_function" "analyzer" {
  filename      = "../src/app.zip"
  function_name = "${var.lambda_function_prefix}-analyzer"
  role          = aws_iam_role.analyzer_role.arn
  handler       = "analyzer.handler"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  memory_size   = 128
  timeout       = 30

  # The filebase64sha256() function is available in Terraform 0.11.12 and later
  # For Terraform 0.11.11 and earlier, use the base64sha256() function and the file() function:
  # source_code_hash = "${base64sha256(file("lambda_function_payload.zip"))}"
  source_code_hash = data.archive_file.app.output_base64sha256

  runtime = "nodejs14.x"

  environment {
    variables = {
      defaultPowerValues = local.defaultPowerValues,
      minRAM             = local.minRAM,
      baseCosts          = local.baseCosts,
      sfCosts            = local.sfCosts,
      visualizationURL   = local.visualizationURL
    }
  }

  depends_on = [aws_lambda_layer_version.lambda_layer]
}

resource "aws_lambda_function" "cleaner" {
  filename      = "../src/app.zip"
  function_name = "${var.lambda_function_prefix}-cleaner"
  role          = aws_iam_role.cleaner_role.arn
  handler       = "cleaner.handler"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  memory_size   = 128
  timeout       = 40

  # The filebase64sha256() function is available in Terraform 0.11.12 and later
  # For Terraform 0.11.11 and earlier, use the base64sha256() function and the file() function:
  # source_code_hash = "${base64sha256(file("lambda_function_payload.zip"))}"
  source_code_hash = data.archive_file.app.output_base64sha256

  runtime = "nodejs14.x"

  environment {
    variables = {
      defaultPowerValues = local.defaultPowerValues,
      minRAM             = local.minRAM,
      baseCosts          = local.baseCosts,
      sfCosts            = local.sfCosts,
      visualizationURL   = local.visualizationURL
    }
  }

  depends_on = [aws_lambda_layer_version.lambda_layer]
}

resource "aws_lambda_function" "executor" {
  filename      = "../src/app.zip"
  function_name = "${var.lambda_function_prefix}-executor"
  role          = aws_iam_role.executor_role.arn
  handler       = "executor.handler"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  memory_size   = 128
  timeout       = 30

  # The filebase64sha256() function is available in Terraform 0.11.12 and later
  # For Terraform 0.11.11 and earlier, use the base64sha256() function and the file() function:
  # source_code_hash = "${base64sha256(file("lambda_function_payload.zip"))}"
  source_code_hash = data.archive_file.app.output_base64sha256

  runtime = "nodejs14.x"

  environment {
    variables = {
      defaultPowerValues = local.defaultPowerValues,
      minRAM             = local.minRAM,
      baseCosts          = local.baseCosts,
      sfCosts            = local.sfCosts,
      visualizationURL   = local.visualizationURL
    }
  }

  depends_on = [aws_lambda_layer_version.lambda_layer]
}

resource "aws_lambda_function" "initializer" {
  filename      = "../src/app.zip"
  function_name = "${var.lambda_function_prefix}-initializer"
  role          = aws_iam_role.initializer_role.arn
  handler       = "initializer.handler"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  memory_size   = 128
  timeout       = 30

  # The filebase64sha256() function is available in Terraform 0.11.12 and later
  # For Terraform 0.11.11 and earlier, use the base64sha256() function and the file() function:
  # source_code_hash = "${base64sha256(file("lambda_function_payload.zip"))}"
  source_code_hash = data.archive_file.app.output_base64sha256

  runtime = "nodejs14.x"

  environment {
    variables = {
      defaultPowerValues = local.defaultPowerValues,
      minRAM             = local.minRAM,
      baseCosts          = local.baseCosts,
      sfCosts            = local.sfCosts,
      visualizationURL   = local.visualizationURL
    }
  }

  depends_on = [aws_lambda_layer_version.lambda_layer]
}

resource "aws_lambda_function" "optimizer" {
  filename      = "../src/app.zip"
  function_name = "${var.lambda_function_prefix}-optimizer"
  role          = aws_iam_role.optimizer_role.arn
  handler       = "optimizer.handler"
  layers        = [aws_lambda_layer_version.lambda_layer.arn]
  memory_size   = 128
  timeout       = 30

  # The filebase64sha256() function is available in Terraform 0.11.12 and later
  # For Terraform 0.11.11 and earlier, use the base64sha256() function and the file() function:
  # source_code_hash = "${base64sha256(file("lambda_function_payload.zip"))}"
  source_code_hash = data.archive_file.app.output_base64sha256

  runtime = "nodejs14.x"

  environment {
    variables = {
      defaultPowerValues = local.defaultPowerValues,
      minRAM             = local.minRAM,
      baseCosts          = local.baseCosts,
      sfCosts            = local.sfCosts,
      visualizationURL   = local.visualizationURL
    }
  }

  depends_on = [aws_lambda_layer_version.lambda_layer]
}


resource "aws_lambda_layer_version" "lambda_layer" {
  filename    = "../src/layer.zip"
  layer_name  = "AWS-SDK-v2_989_0"
  description = "AWS SDK 2.989.0"
  compatible_architectures = ["x86_64"]
  compatible_runtimes = ["nodejs14.x"]

  depends_on = [data.archive_file.layer]
}

