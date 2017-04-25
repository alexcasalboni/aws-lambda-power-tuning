# AWS Lambda Power Tuning - made with [![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
Step Functions state machine generator for AWS Lambda Power Tuning.

The state machine is designed to be **quick** and **language agnostic**. You can provide **any Lambda Function as input** and the state machine will **estimate the best power configuration to minimize cost**. Your Lambda Function will be executed in your AWS account (i.e. real HTTP calls, SDK calls, cold starts, etc.) and you can enable parallel execution to generate results in just a few seconds.


## How to deploy the state machine

First, clone this repo and install npm dependencies:
```
$ git clone https://github.com/alexcasalboni/aws-lambda-power-tuning.git
$ cd aws-lambda-power-tuning
$ npm install
```

Don't forget to install and configure the Serverless Framework too:

```
$ npm install serverless -g
$ serverless config credentials --provider aws --key XXX --secret YYY
```

Then you can generate the state machine by providing your AWS Account ID. Optionally, you can specify the AWS region and a comma-separated list of RAM values:

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
    "num": 100
}
```

As soon as you click "**Start Execution**", you'll be able to follow the execution flow on the state machine chart. Here is a sample screenshot:

![state-machine](state-machine-screenshot.png?raw=true)

Once the execution has completed, you will find the execution results in the "**Output**" tab of the "**Execution Details**" section. The output will contain the optimal RAM configuration and its corresponding average cost per execution.

## State Machine Input

The AWS Step Functions state machine accepts the following parameters:

* **lambdaARN** (required, string): ARN of the Lambda Function you want to optimize
* **num** (required, integer): the # of invocations for each power configuration (recommended: between 10 and 100)
* **payload** (string or object): the static payload that will be used for every invocation
* **enableParallel** (false by default): if true, all the invocations will be executed in parallel (note: depending on the value of `num`, you may experience throttling when setting `enableParallel` to true)


## State Machine Output

The AWS Step Functions state machine will return the following outputs:

* **power**: the optimal power configuration
* **cost**: the corresponding average cost (per invocation)


## State Machine Internals

The AWS Step Functions state machine is composed by four Lambda Functions:

* **initializer**: create N versions and aliases corresponding to the power values provided as input (e.g. 128MB, 256MB, etc.)
* **executor**: execute the given Lambda Function `num` times, extract execution time from logs, and compute average cost per invocation (one parallel branch for each power value)
* **cleaner**: delete all the previously generated aliases and versions
* **finalizer**: compute the optimal power value (current logic: lowest average cost per invocation)


## Contributing
Contributors and PRs are always welcome!

### Testing

Run `npm install --dev` and `npm test`.

Current test coverage: 91%.