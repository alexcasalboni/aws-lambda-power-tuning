# How to deploy the AWS Lambda Power Tuning tool

There are multiple options to deploy the tool.

If you are familiar with Infrastructure as Code, there are 4 ways for you to create all of the resources neccesary for Lambda Power Tuning.

The following three options utilize [AWS CloudFormation](https://aws.amazon.com/cloudformation/) on your behalf to create the neccessary resources. Each will create a new CloudFormation stack in your AWS account containing all the resources for the Lambda Power Tuning tool.
1. The easiest way is to [deploy the app via the AWS Serverless Application Repository (SAR)](#option1)
1. Manually [using the AWS SAM CLI](#option2)
1. Manually [using the AWS CDK](#option3)

You can also [deploy manually with Terraform](#option6) by Hashicorp.

If you want to use Terraform natively (which circumvents Cloudformation), see [Option 7](#option7)

If you don't want to deal with any Infrastructure as Code tool, you can use one of the following:
1. The [Lumigo CLI](#option4) (which will take care of both deployment and execution)
1.  The [Lambda Power Tuner UI](#option5) 

Read more about the [deployment parameters here](README-INPUT-OUTPUT.md#state-machine-configuration-at-deployment-time).

## Option 1: AWS Serverless Application Repository<a name="option1"></a>

You can find this app in the [Serverless Application Repository](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:451282441545:applications~aws-lambda-power-tuning) and deploy it with just a few clicks in the AWS Management Console.

You can also integrate the SAR app in your existing CloudFormation stacks - check [scripts/deploy-sar-app.yml](scripts/deploy-sar-app.yml) and [scripts/deploy-sar-app.sh](scripts/deploy-sar-app.sh) for a sample implementation.


## Option 2: Build and deploy with the AWS SAM CLI<a name="option2"></a>

1. Install the [AWS SAM CLI in your local environment](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).

1. Configure your [AWS credentials (requires AWS CLI installed)](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration):
    ```bash
    $ aws configure
    ```
1. Clone this git repository: 
    ```bash
    $ git clone https://github.com/alexcasalboni/aws-lambda-power-tuning.git
    ```
1. Build the Lambda layer and any other dependencies:
    ```bash
    $ cd ./aws-lambda-power-tuning
    $ sam build -u
    ```
    [`sam build -u`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html) will run SAM build using a Docker container image that provides an environment similar to that which your function would run in. SAM build in-turn looks at your AWS SAM template file for information about Lambda functions and layers in this project.
    
    Once the build has completed you should see output that states `Build Succeeded`. If not there will be error messages providing guidance on what went wrong.
1.  Deploy the applicaiton using the SAM deploy "guided" mode:
    ```bash
    $ sam deploy -g
    ```
    [`sam deploy -g`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html) will provide simple prompts to walk you through the process of deploying the tool. Provide a unique name for the 'Stack Name' and supply the [AWS Region](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html#Concepts.RegionsAndAvailabilityZones.Regions) you want to run the tool in and then you can select the defaults for testing of this tool. After accepting the promted questions with a "Y" you can optionally save your application configuration. 

    After that the SAM CLI will run the required commands to create the resources for the Lambda Power Tuning tool. The CloudFormation outputs shown will highlight any issues or failures.
    
    If there are no issues, once complete you will see the stack ouputs and a `Successfully created/updated stack` message.
  

## Option 3: Deploy the AWS SAR app with AWS CDK<a name="option3"></a>

1. [Install AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) and [configure your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#cli-quick-configuration):

    ```bash
    $ npm install -g aws-cdk
    $ aws configure
    ```

1. If you already have a CDK project you can include the following to use the [sam module](https://docs.aws.amazon.com/cdk/api/latest/docs/aws-sam-readme.html):

    ```typescript
    import sam = require('@aws-cdk/aws-sam');
    
    new sam.CfnApplication(this, 'powerTuner', {
      location: {
        applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
        semanticVersion: '4.2.0'
      },
      parameters: {
        "lambdaResource": "*",
        "PowerValues": "128,256,512,1024,1536,3008"
      }
    })
    ```

    Alternatively, you can use [CDK Patterns](https://github.com/cdk-patterns/serverless) to give you a pre configured project in either TypeScript or Python:
    
    ```bash
    # For the TypeScript CDK version
    npx cdkp init the-lambda-power-tuner
    
    # or for the Python CDK version
    npx cdkp init the-lambda-power-tuner --lang=python
    ```

1. To deploy the TypeScript version you just need to:

    ```bash
    cd the-lambda-power-tuner
    npm run deploy
    ```

    For Python deployment, see the instructions [here](https://github.com/cdk-patterns/serverless#2-download-pattern-in-python-or-typescript-cdk).

## Option 4: Deploy with the Lumigo CLI<a name="option4"></a>

1. Install the Lumigo CLI:
    ```bash
    $ npm install -g lumigo-cli
    ```
1. Power-tune your functions as follows:
    ```bash
    $ lumigo-cli powertune-lambda <OPTIONS>
    ```

For the full documentation of the command parameters:
```bash
$ lumigo-cli --help powertune-lambda
```
(or check it out [here](https://www.npmjs.com/package/lumigo-cli#lumigo-cli-powertune-lambda)).

## Option 5: Deploy via AWS Lambda Power Tuner UI<a name="option5"></a>

You can deploy and interact with Lambda Power Tuning with an ad-hoc web interface. This UI will deploy everything you need to power-tune your functions and also simplify the input/output management for Step Functions via API Gateway.

You can find the open-source project and the instructions to deploy it here: [mattymoomoo/aws-power-tuner-ui](https://github.com/mattymoomoo/aws-power-tuner-ui).

![Power Tuner UI](https://github.com/mattymoomoo/aws-power-tuner-ui/blob/master/imgs/website.png?raw=true)

## Option 6: Deploy the SAR app with Terraform<a name="option6"></a>

Simply add the `aws_serverlessapplicationrepository_cloudformation_stack` resource below to your Terraform code and deploy as usual through `terraform apply`.

```hcl
resource "aws_serverlessapplicationrepository_cloudformation_stack" "lambda-power-tuning" {
  name             = "lambda-power-tuner"
  application_id   = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning"
  capabilities     = ["CAPABILITY_IAM"]
  # Uncomment the next line to deploy a specific version
  # semantic_version = "4.2.0"

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

## Option 7: deploy natively with Terraform<a name="option7"></a>

Please see the documentation [here](terraform/Readme.md).


## How to execute the state machine once deployed?

See [here](README-EXECUTE.md).
