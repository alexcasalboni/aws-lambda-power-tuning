# How to deploy the AWS Lambda Power Tuning tool

There are 5 deployment options for deploying the tool using Infrastructure as Code (IaC).


1. The easiest way is to [deploy the app via the AWS Serverless Application Repository (SAR)](#option1). 
1. [Using the AWS SAM CLI](#option2)
1. [Using the AWS CDK](#option3)
1. [Using Terraform by Hashicorp and SAR](#option4)
1. [Using native Terraform](#option5)

Read more about the [deployment parameters here](README.md#state-machine-configuration-at-deployment-time).

## Option 1: AWS Serverless Application Repository<a name="option1"></a>

You can find this app in the [Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:451282441545:applications~aws-lambda-power-tuning) and deploy it with just a few clicks in the AWS Management Console.

You can also integrate the SAR app in your existing CloudFormation stacks - check [scripts/deploy-sar-app.yml](scripts/deploy-sar-app.yml) and [scripts/deploy-sar-app.sh](scripts/deploy-sar-app.sh) for a sample implementation.


## Option 2: Build and deploy with the AWS SAM CLI<a name="option2"></a>

**Note**: This method requires Docker.

1. Install the [AWS SAM CLI in your local environment](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).

1. Configure your [AWS credentials (requires AWS CLI installed)](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration):
    ```bash
    $ aws configure
    ```
1. Install [Docker](https://docs.docker.com/get-docker/).
1. Clone this git repository: 
    ```bash
    $ git clone https://github.com/alexcasalboni/aws-lambda-power-tuning.git
    ```
1. Build the Lambda layer and any other dependencies (Docker is required):
    ```bash
    $ cd ./aws-lambda-power-tuning
    $ sam build -u
    ```
    [`sam build -u`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html) will run SAM build using a Docker container image that provides an environment similar to that which your function would run in. SAM build in-turn looks at your AWS SAM template file for information about Lambda functions and layers in this project.
    
    Once the build completes successfully you will see output stating `Build Succeeded`. If the build is not successful, there will be error messages providing guidance on what went wrong.
1.  Deploy the application using the guided SAM deploy mode:
    ```bash
    $ sam deploy -g
    ```
    * For **Stack Name**, enter a unique name for the stack.
    * For **AWS Region**, enter the region you want to deploy in. 
    
    Accept the defaults for all other prompts.
    
    [`sam deploy -g`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html)  provides simple prompts to walk you through the process of deploying the tool. The responses are saved in a configuration file, `samconfig.toml`, to be reused during subsequent deployments.

    SAM CLI will run the required commands to create the resources for the Lambda Power Tuning tool. 
    
    A successful deployment displays the message `Successfully created/updated stack`. 
1. To delete Lambda Power Tuning, run
    ```bash
    sam delete
    ```
    Answer `Y` to the prompts.
  

## Option 3: Deploy the AWS SAR app with AWS CDK<a name="option3"></a>

1. [Install AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html).
    ```bash
    $ npm install -g aws-cdk
    ```

1. [Bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_bootstrap) your account.

1. [Configure your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration):

    ```bash
    $ aws configure
    ```

1. If you already have a CDK project you can include the following to use the [sam module](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-sam-readme.html):

    ```typescript
    import sam = require('@aws-cdk/aws-sam');
    
    new sam.CfnApplication(this, 'powerTuner', {
      location: {
        applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
        semanticVersion: '4.3.6'
      },
      parameters: {
        "lambdaResource": "*",
        "PowerValues": "128,256,512,1024,1536,3008"
      }
    })
    ```

Alternatively, you can build and deploy the solution from the source in this repo. See the following pages for language-specific instructions.
    
  ### TypeScript
See the [Typescript instructions](cdk/typescript/README.md)
    
  ### Python
See the [Python instructions](cdk/python/README.md)
  
  ### go
See the [go instructions](cdk/go/README.md)

### C\#
See the [Csharp instructions](cdk/csharp/README.md)

## Option 4: Deploy the SAR app with Terraform<a name="option4"></a>

Simply add the `aws_serverlessapplicationrepository_cloudformation_stack` resource below to your Terraform code and deploy as usual through `terraform apply`.

```hcl
resource "aws_serverlessapplicationrepository_cloudformation_stack" "lambda-power-tuning" {
  name             = "lambda-power-tuner"
  application_id   = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning"
  capabilities     = ["CAPABILITY_IAM"]
  # Uncomment the next line to deploy a specific version
  # semantic_version = "4.3.6"

  parameters = {
    # All of these parameters are optional and are only shown here for demonstration purposes
    # See https://github.com/alexcasalboni/aws-lambda-power-tuning/blob/master/README-INPUT-OUTPUT.md#state-machine-input-at-deployment-time
    # PowerValues           = "128,192,256,512,1024,2048,3072,4096,5120,6144,7168,8192,9216,10240"
    # lambdaResource        = "*"
    # totalExecutionTimeout = 900
    # visualizationURL      = "https://lambda-power-tuning.show/"
  }
}
```

See the [Terraform documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/serverlessapplicationrepository_cloudformation_stack) for more configuration options of `aws_serverlessapplicationrepository_cloudformation_stack`.

If you don't yet have a Terraform project, check out the [Terraform introduction](https://www.terraform.io/intro/index.html).

## Option 5: Deploy natively with Terraform<a name="option5"></a>

The Terraform modules are located in the [terraform](terraform) directory. Deployment documentation is [here](terraform/Readme.md).

## State machine configuration (at deployment time)

The CloudFormation template (used for option 1 to 4) accepts the following parameters:

|                    <div style="width:260px">**Parameter**</div>                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                    |
|:-----------------------------------------------------------------------------------:|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **PowerValues**<br>type: _list of numbers_<br>default: [128,256,512,1024,1536,3008] | These power values (in MB) will be used as the default in case no `powerValues` input parameter is provided at execution time.                                                                                                                                                                                                                                                                                                 |
|    **visualizationURL**<br>type: _string_<br>default: `lambda-power-tuning.show`    | The base URL for the visualization tool, you can bring your own visualization tool.                                                                                                                                                                                                                                                                                                                                            |
|            **totalExecutionTimeout**<br>type: _number_<br>default: `300`            | The timeout in seconds applied to all functions of the state machine.                                                                                                                                                                                                                                                                                                                                                          |
|                **lambdaResource**<br>type: _string_<br>default: `*`                 | The `Resource` used in IAM policies; it's `*` by default but you could restrict it to a prefix or a specific function ARN.                                                                                                                                                                                                                                                                                                     |
|                    **permissionsBoundary**<br>type: _string_<br>                    | The ARN of a permissions boundary (policy), applied to all functions of the state machine.                                                                                                                                                                                                                                                                                                                                     |
|                      **payloadS3Bucket**<br>type: _string_<br>                      | The S3 bucket name used for large payloads (>256KB); if provided, it's added to a custom managed IAM policy that grants read-only permission to the S3 bucket; more details in the [S3 payloads section](README-ADVANCED.md#user-content-s3-payloads).                                                                                                                                                                         |
|                 **payloadS3Key**<br>type: _string_<br>default: `*`                  | The S3 object key used for large payloads (>256KB); the default value grants access to all S3 objects in the bucket specified with `payloadS3Bucket`; more details in the [S3 payloads section](README-ADVANCED.md#user-content-s3-payloads).                                                                                                                                                                                  |
|                       **layerSdkName**<br>type: _string_<br>                        | The name of the SDK layer, in case you need to customize it (optional).                                                                                                                                                                                                                                                                                                                                                        |
|            **logGroupRetentionInDays**<br>type: _number_<br>default: `7`            | The number of days to retain log events in the Lambda log groups (a week by default).                                                                                                                                                                                                                                                                                                                                          |
|            **securityGroupIds**<br>type: _list of SecurityGroup IDs_<br>            | List of Security Groups to use in every Lambda function's VPC Configuration (optional); please note that your VPC should be configured to allow public internet access (via NAT Gateway) or include VPC Endpoints to the Lambda service.                                                                                                                                                                                       |
|                   **subnetIds**<br>type: _list of Subnet IDs_<br>                   | List of Subnets to use in every Lambda function's VPC Configuration (optional); please note that your VPC should be configured to allow public internet access (via NAT Gateway) or include VPC Endpoints to the Lambda service.                                                                                                                                                                                               |
| **stateMachineNamePrefix**<br>type: _string_<br>default: `powerTuningStateMachine`  | Allows you to customize the name of the state machine. Maximum 43 characters, only alphanumeric (plus `-` and `_`). The last portion of the `AWS::StackId` will be appended to this value, so the full name will look like `powerTuningStateMachine-89549da0-a4f9-11ee-844d-12a2895ed91f`. Note: `StateMachineName` has a maximum of 80 characters and 36+1 from the `StackId` are appended, allowing 43 for a custom prefix.  |

Please note that the total execution time should stay below 300 seconds (5 min), which is the default timeout. You can estimate the total execution timeout based on the average duration of your functions. For example, if your function's average execution time is 5 seconds and you haven't enabled `parallelInvocation`, you should set `totalExecutionTimeout` to at least `num * 5`: 50 seconds if `num=10`, 500 seconds if `num=100`, and so on. If you have enabled `parallelInvocation`, usually you don't need to tune the value of `totalExecutionTimeout` unless your average execution time is above 5 min. If you have set a sleep between invocations, remember to include that in your timeout calculations.


## How to execute the state machine once deployed

See the [execution](README-EXECUTE.md) instructions to run the state machine.
