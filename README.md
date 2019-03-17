# AWS Lambda Power Tuning - made with [![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

[![Build Status](https://travis-ci.com/alexcasalboni/aws-lambda-power-tuning.svg?branch=master)](https://travis-ci.org/alexcasalboni/aws-lambda-power-tuning)
[![Coverage Status](https://coveralls.io/repos/github/alexcasalboni/aws-lambda-power-tuning/badge.svg)](https://coveralls.io/github/alexcasalboni/aws-lambda-power-tuning)
[![GitHub license](https://img.shields.io/github/license/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/blob/master/LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/alexcasalboni/aws-lambda-power-tuning/graphs/commit-activity)
[![GitHub issues](https://img.shields.io/github/issues/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/issues)
[![Open Source Love svg2](https://badges.frapsoft.com/os/v2/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/)
[![GitHub stars](https://img.shields.io/github/stars/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/stargazers)

Step Functions state machine generator for AWS Lambda Power Tuning.

The state machine is designed to be **quick** and **language agnostic**. You can provide **any Lambda Function as input** and the state machine will **estimate the best power configuration to minimize cost**. Your Lambda Function will be executed in your AWS account (i.e. real HTTP calls, SDK calls, cold starts, etc.) and you can enable parallel execution to generate results in just a few seconds.


## How to deploy the state machine

First, install the Serverless Framework and configure your AWS credentials:


```
$ npm install serverless -g
$ serverless config credentials --provider aws --key XXX --secret YYY
```

Now, you can quickly install this service as follows:

```
$ serverless install -u https://github.com/alexcasalboni/aws-lambda-power-tuning
```

The Serverless Framework will download and unzip the repository, but it won't install dependencies. Don't forget to install npm dependencies before generating the state machine:

```
$ cd aws-lambda-power-tuning
$ npm install
```

Then you can generate the dynamic state machine by providing your AWS Account ID. Optionally, you can specify the AWS region and a comma-separated list of RAM values:

```
$ npm run generate -- -A ACCOUNT_ID [-R eu-west-1] [-P 128,256,512,1024]
```

Finally, you can deploy everything:

```
$ serverless deploy
```

## How to execute the state machine

Once the state machine and all the Lambda Functions have been deployed, you will need to execute the state machine and provide an input object.

You will find the new state machine [here](https://console.aws.amazon.com/states/). Enter the state machine named **LambdaPowerStateMachine** and click "**New execution**". Here you can provide the execution input and an execution id (see section below for the full documentation):

```
{
    "lambdaARN": "your-lambda-function-arn",
    "num": 10
}
```

As soon as you click "**Start Execution**", you'll be able to follow the execution flow on the state machine chart. Here is a sample screenshot:

![state-machine](state-machine-screenshot.png?raw=true)

Once the execution has completed, you will find the execution results in the "**Output**" tab of the "**Execution Details**" section. The output will contain the optimal RAM configuration and its corresponding average cost per execution.

## State Machine Input

The AWS Step Functions state machine accepts the following parameters:

* **lambdaARN** (required, string): ARN of the Lambda Function you want to optimize
* **num** (required, integer): the # of invocations for each power configuration (minimum 5, recommended: between 10 and 100)
* **payload** (string or object): the static payload that will be used for every invocation
* **parallelInvocation** (false by default): if true, all the invocations will be executed in parallel (note: depending on the value of `num`, you may experience throttling when setting `parallelInvocation` to true)


## State Machine Output

The AWS Step Functions state machine will return the following outputs:

* **power**: the optimal power configuration
* **cost**: the corresponding average cost (per invocation)
* **duration**: the corresponding average duration (per invocation)


## State Machine Internals

The AWS Step Functions state machine is composed by four Lambda Functions:

* **initializer**: create N versions and aliases corresponding to the power values provided as input (e.g. 128MB, 256MB, etc.)
* **executor**: execute the given Lambda Function `num` times, extract execution time from logs, and compute average cost per invocation
* **cleaner**: delete all the previously generated aliases and versions
* **finalizer**: compute the optimal power value (current logic: lowest average cost per invocation)

Initializer, cleaner and finalizer are executed only once, while the executor is used by N parallel branches of the state machine (one for each configured power value). By default, the executor will execute the given Lambda Function `num` consecutive times, but you can enable parallel invocation by setting `parallelInvocation` to `true`. Please note that the total invocation time should stay below 300 seconds (5 min), which means that the average duration of your functions should stay below 3 seconds with `num=100`, 30 seconds with `num=10`, and so on.

## Contributing
Contributors and PRs are always welcome!

### Tests and coverage

Install dev dependencies with `npm install --dev`. Then run tests with `npm test`, or coverage with `npm run coverage`.
