# How to deploy the state machine

There are multiple ways to deploy the project.

If you are familiar with Infrastructure as Code, the easiest way is to deploy the app via the Serverless Application Repository (SAR) - see option 1 and 3. If you prefer Terraform, see option 6.

If you prefer to verify and own the full YAML template, feel free to fork this repo and deploy everything with AWS SAM CLI - see option 2.

If you don't want to deal with CloudFormation or SAR at all, you can use the Lumigo CLI (which will take care of both deployment and execution) or the Lambda Power Tuner UI - see option 4 and 5.


## Option 1: AWS Serverless Application Repository

You can find this app in the [Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:451282441545:applications~aws-lambda-power-tuning) and deploy it with just a few clicks in the AWS Management Console.

You can also integrate the SAR app in your existing CloudFormation stacks - check [scripts/deploy-sar-app.yml](scripts/deploy-sar-app.yml) and [scripts/deploy-sar-app.sh](scripts/deploy-sar-app.sh) for a sample implementation.


## Option 2: fork this repo and deploy with AWS SAM

In case you want to deploy it "manually", you can run [scripts/deploy.sh](scripts/deploy.sh).

The script uses the [AWS SAM CLI](https://github.com/awslabs/aws-sam-cli) to create a new CloudFormation stack in your account.

First, install AWS SAM and [configure your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration):


```bash
$ pip install aws-sam-cli
$ aws configure
```

Now, you can clone this repository as follows:

```bash
$ git clone https://github.com/alexcasalboni/aws-lambda-power-tuning.git
```

Configure your deployment bucket name ([create one first!](https://docs.aws.amazon.com/AmazonS3/latest/user-guide/create-bucket.html)) and stack name in the deployment script:


```bash
# config
BUCKET_NAME=your-sam-templates-bucket
STACK_NAME=lambda-power-tuning
PowerValues='128,512,1024,1536,3008'
```

You can finally deploy the serverless app:

```bash
$ bash scripts/deploy.sh
```

## Option 3: deploy the SAR app with AWS CDK

First, [install AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) and [configure your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration):

```bash
$ pip install aws-sam-cli
$ aws configure
```

If you already have a CDK project you can include the following to use the [sam module](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-sam-readme.html):

```typescript
import sam = require('@aws-cdk/aws-sam');

new sam.CfnApplication(this, 'powerTuner', {
  location: {
    applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
    semanticVersion: '3.4.2'
  },
  parameters: {
    "lambdaResource": "*",
    "PowerValues": "128,256,512,1024,1536,3008"
  }
})
```

Alternatively you can use [CDK Patterns](https://github.com/cdk-patterns/serverless) to give you a pre configured project in either TypeScript or Python:

```bash
# For the TypeScript CDK version
npx cdkp init the-lambda-power-tuner

# or for the Python CDK version
npx cdkp init the-lambda-power-tuner --lang=python
```

To deploy the TypeScript version you just need to:

```bash
cd the-lambda-power-tuner
npm run deploy
```

For Python deployment, see the instructions [here](https://github.com/cdk-patterns/serverless#2-download-pattern-in-python-or-typescript-cdk).

## Option 4: deploy with the Lumigo CLI

You can install the Lumigo CLI:

```bash
$ npm install -g lumigo-cli
```

And then power-tune your functions as follows:

```bash
$ lumigo-cli powertune-lambda <OPTIONS>
```

For the full documentation of the command parameters:

```bash
$ lumigo-cli --help powertune-lambda
```

(or check it out [here](https://www.npmjs.com/package/lumigo-cli#lumigo-cli-powertune-lambda)).


## Option 5: deploy via AWS Lambda Power Tuner UI

You can deploy and interact with Lambda Power Tuning with an ad-hoc web interface. This UI will deploy everything you need to power-tune your functions and also simplify the input/output management for Step Functions via API Gateway.

You can find the open-source project and the instructions to deploy it here: [mattymoomoo/aws-power-tuner-ui](https://github.com/mattymoomoo/aws-power-tuner-ui).

![Power Tuner UI](https://github.com/mattymoomoo/aws-power-tuner-ui/blob/master/imgs/website.png?raw=true)

## Option 6: deploy the SAR app with Terraform

Simply add the `aws_serverlessapplicationrepository_cloudformation_stack` resource below to your Terraform code and deploy as usual through `terraform apply`.

```hcl
resource "aws_serverlessapplicationrepository_cloudformation_stack" "lambda-power-tuning" {
  name             = "lambda-power-tuner"
  application_id   = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning"
  capabilities     = ["CAPABILITY_IAM"]
  # Uncomment the next line to deploy a specific version
  # semantic_version = "3.4.2"

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


## How to execute the state machine once deployed?

See [here](README-EXECUTE.md).
