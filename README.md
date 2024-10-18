# AWS Lambda Power Tuning

[![Build Status](https://travis-ci.com/alexcasalboni/aws-lambda-power-tuning.svg?branch=master)](https://app.travis-ci.com/github/alexcasalboni/aws-lambda-power-tuning)
[![Coverage Status](https://coveralls.io/repos/github/alexcasalboni/aws-lambda-power-tuning/badge.svg)](https://coveralls.io/github/alexcasalboni/aws-lambda-power-tuning)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/alexcasalboni/aws-lambda-power-tuning/graphs/commit-activity)
[![GitHub issues](https://img.shields.io/github/issues/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/issues)
[![Open Source Love svg2](https://badges.frapsoft.com/os/v2/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/)

AWS Lambda Power Tuning is a state machine powered by AWS Step Functions that helps you optimize your Lambda functions for cost and/or performance in a data-driven way.

The state machine is designed to be easy to deploy and fast to execute. Also, it's language agnostic so you can optimize any Lambda functions in your account.

Basically, you can provide a Lambda function ARN as input and the state machine will invoke that function with multiple power configurations (from 128MB to 10GB, you decide which values). Then it will analyze all the execution logs and suggest you the best power configuration to minimize cost and/or maximize performance.

> [!NOTE]
> Please note that the input function will be executed in your AWS account and perform real HTTP requests, SDK calls, cold starts, etc. The state machine also supports cross-region invocations and you can enable parallel execution to generate results in just a few seconds.

## What does the state machine look like?

It's pretty simple and you can visually inspect each step in the AWS management console.

![state-machine](imgs/state-machine-screenshot.png?raw=true)

## What can I expect from AWS Lambda Power Tuning?

The state machine will generate a visualization of average cost and speed for each power configuration.

![visualization1](imgs/visualization1.jpg?raw=true)

The graph helps you understand the impact of the power configuration on cost and performance for your specific AWS Lambda function.



For example, this is what the results look like for two CPU-intensive functions, which become cheaper AND faster with more power:



How to interpret the chart above: execution time goes from 35s with 128MB to less than 3s with 1.5GB, while being 14% cheaper to run.

![visualization2](imgs/visualization2.jpg?raw=true)

How to interpret the chart above: execution time goes from 2.4s with 128MB to 300ms with 1GB, for the very same average cost.

## Quick Start

> [!NOTE]
> There are 5 deployment options for deploying AWS Lambda Power Tuning using Infrastucture as Code (IaC). In this Quick Start guide we will use the AWS SAM CLI. Read more about the [deployment options here](README-DEPLOY.md).

### How to deploy the AWS Lambda Power Tuning tool with SAM CLI

**Prerequisites**: This method requires Docker.

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

Deployment configuration [config](README-DEPLOY.md#state-machine-configuration-at-deployment-time)

### How to run the state machine

>[!NOTE]
>You can run the state machine manually or programmatically, see the detailed documentation [here](README-EXECUTE.md).

In this Quick Start guide we will execute the state machine with the CLI.

You'll find a few sample scripts in the `scripts` folder.

The `scripts/sample-execution-input.json` let's you specify execution parameters, such as the lambdaARN and the number of invocations. You can find an extensive list of [execution parameters here](README-EXECUTE.md#state-machine-input-at-execution-time). To run the state machine you have to run the execute script in `scripts/execute.sh`.

Here's a typical state machine input with basic parameters:

```json
{
    "lambdaARN": "your-lambda-function-arn",
    "powerValues": [128, 256, 512, 1024],
    "num": 50,
    "payload": {}
}
```

### State Machine Output

The state machine will return the following output:

```json
{
  "results": {
    "power": "128",
    "cost": 0.0000002083,
    "duration": 2.9066666666666667,
    "stateMachine": {
      "executionCost": 0.00045,
      "lambdaCost": 0.0005252,
      "visualization": "https://lambda-power-tuning.show/#<encoded_data>"
    },
    "stats": [{ "averagePrice": 0.0000002083, "averageDuration": 2.9066666666666667, "value": 128}, ... ]
  }
}
```

More details on each value:

* **results.power**: the optimal power configuration (RAM)
* **results.cost**: the corresponding average cost (per invocation)
* **results.duration**: the corresponding average duration (per invocation)
* **results.stateMachine.executionCost**: the AWS Step Functions cost corresponding to this state machine execution (fixed value for "worst" case)
* **results.stateMachine.lambdaCost**: the AWS Lambda cost corresponding to this state machine execution (depending on `num` and average execution time)
* **results.stateMachine.visualization**: if you visit this autogenerated URL, you will be able to visualize and inspect average statistics about cost and performance; important note: average statistics are NOT shared with the server since all the data is encoded in the URL hash ([example](https://lambda-power-tuning.show/#gAAAAQACAAQABsAL;ZooQR4yvkUa/pQRGRC5zRaADHUVjOftE;QdWhOEMkoziDT5Q4xhiIOMYYiDi6RNc4)), which is available only client-side
* **results.stats**: the average duration and cost for every tested power value configuration (only included if `includeOutputResults` is set to a truthy value)

## Data visualization

You can visually inspect the tuning results to identify the optimal tradeoff between cost and performance.

![visualization](imgs/visualization.png?raw=true)

The data visualization tool has been built by the community: it's a static website deployed via AWS Amplify Console and it's free to use. If you don't want to use the visualization tool, you can simply ignore the visualization URL provided in the execution output. No data is ever shared or stored by this tool.

Website repository: [matteo-ronchetti/aws-lambda-power-tuning-ui](https://github.com/matteo-ronchetti/aws-lambda-power-tuning-ui)

Optionally, you could deploy your own custom visualization tool and configure the CloudFormation Parameter named `visualizationURL` with your own URL.

## Additional features, considerations, and internals

[Here](README-ADVANCED.md) you can find out more about some advanced features of this project, its internals, and some considerations about security and execution cost.

## Contributing

Feature requests and pull requests are more than welcome!

### How to get started with local development?

For this repository, install dev dependencies with `npm install`. You can run tests with `npm test`, linting with `npm run lint`, and coverage with `npm run coverage`. Unit tests will run automatically on every commit and PR.
