# AWS Lambda Power Tuning

[![Build Status](https://travis-ci.com/alexcasalboni/aws-lambda-power-tuning.svg?branch=master)](https://travis-ci.org/alexcasalboni/aws-lambda-power-tuning)
[![Coverage Status](https://coveralls.io/repos/github/alexcasalboni/aws-lambda-power-tuning/badge.svg)](https://coveralls.io/github/alexcasalboni/aws-lambda-power-tuning)
[![GitHub license](https://img.shields.io/github/license/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/blob/master/LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/alexcasalboni/aws-lambda-power-tuning/graphs/commit-activity)
[![GitHub issues](https://img.shields.io/github/issues/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/issues)
[![Open Source Love svg2](https://badges.frapsoft.com/os/v2/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/)
[![GitHub stars](https://img.shields.io/github/stars/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/stargazers)

AWS Lambda Power Tuning is a state machine powered by AWS Step Functions that helps you optimize your Lambda functions for cost and/or performance in a data-driven way.

The state machine is designed to be easy to deploy and fast to execute. Also, it's language agnostic so you can optimize any Lambda functions in your account.

Basically, you can provide a Lambda function ARN as input and the state machine will invoke that function with multiple power configurations (from 128MB to 10GB, you decide which values). Then it will analyze all the execution logs and suggest you the best power configuration to minimize cost and/or maximize performance.

Please note that the input function will be executed in your AWS account - performing real HTTP requests, SDK calls, cold starts, etc. The state machine also supports cross-region invocations and you can enable parallel execution to generate results in just a few seconds.

## What does the state machine look like?

It's pretty simple and you can visually inspect each step in the AWS management console.


![state-machine](imgs/state-machine-screenshot.png?raw=true)


## What results can I expect from Lambda Power Tuning?

The state machine will generate a visualization of average cost and speed for each power configuration.

For example, this is what the results look like for two CPU-intensive functions, which become cheaper AND faster with more power:

![visualization1](imgs/visualization1.jpg?raw=true)

How to interpret the chart above: execution time goes from 35s with 128MB to less than 3s with 1.5GB, while being 14% cheaper to run.

![visualization2](imgs/visualization2.jpg?raw=true)

How to interpret the chart above: execution time goes from 2.4s with 128MB to 300ms with 1GB, for the very same average cost.


## How to deploy the state machine 

There are a few options documented [here](README-DEPLOY.md).


## How to execute the state machine

You can execute the state machine manually or programmatically, see the documentation [here](README-EXECUTE.md).


## State Machine Input and Output

Here's a typical execution input with basic parameters:

```json
{
    "lambdaARN": "your-lambda-function-arn",
    "powerValues": [128, 256, 512, 1024],
    "num": 50,
    "payload": {}
}
```

Full input documentation [here](README-INPUT-OUTPUT.md#user-content-state-machine-input).

The state machine output will look like this:

```json
{
  "results": {
    "power": "128",
    "cost": 0.0000002083,
    "duration": 2.906,
    "stateMachine": {
      "executionCost": 0.00045,
      "lambdaCost": 0.0005252,
      "visualization": "https://lambda-power-tuning.show/#<encoded_data>"
    }
  }
}
```

Full output documentation [here](README-INPUT-OUTPUT.md#user-content-state-machine-output).


## Data visualization

You can visually inspect the tuning results to identify the optimal tradeoff between cost and performance.

![visualization](imgs/visualization.png?raw=true)

The data visualization tool has been built by the community: it's a static website deployed via AWS Amplify Console and it's free to use. If you don't want to use the visualization tool, you can simply ignore the visualization URL provided in the execution output. No data is ever shared or stored by this tool.

Website repository: [matteo-ronchetti/aws-lambda-power-tuning-ui](https://github.com/matteo-ronchetti/aws-lambda-power-tuning-ui)

Optionally, you could deploy your own custom visualization tool and configure the CloudFormation Parameter named `visualizationURL` with your own URL.

## Power Tuner UI

Lambda Power Tuner UI is a web interface to simplify the deployment and execution of Lambda Power Tuning. It's built and maintained by [Matthew Dorrian](https://twitter.com/DorrianMatthew) and it aims at providing a consistent interface and a uniform developer experience across teams and projects.

![Power Tuner UI](https://github.com/mattymoomoo/aws-power-tuner-ui/blob/master/imgs/website.png?raw=true)

Power Tuner UI repository: [mattymoomoo/aws-power-tuner-ui](https://github.com/mattymoomoo/aws-power-tuner-ui)

## Additional features, considerations, and internals

[Here](README-ADVANCED.md) you can find out more about some advanced features of this project, its internals, and some considerations about security and execution cost.


## CHANGELOG (SAR versioning)

From most recent to oldest, with major releases in bold:

* *3.4.2* (2020-12-03): permissions boundary bugfix (Step Functions role)
* *3.4.1* (2020-12-02): permissions boundary support
* ***3.4.0*** (2020-12-01): 1ms billing
* *3.3.3* (2020-07-17): payload logging bugfix for pre-processors
* *3.3.2* (2020-06-17): weighted payloads bugfix (for real)
* *3.3.1* (2020-06-16): weighted payloads bugfix
* ***3.3.0*** (2020-06-10): Pre/Post-processing functions, correct regional pricing, customizable execution timeouts, and other internal improvements
* *3.2.5* (2020-05-19): improved logging for weighted payloads and in case of invocation errors
* *3.2.4* (2020-03-11): dryRun bugfix
* *3.2.3* (2020-02-25): new dryRun input parameter
* *3.2.2* (2020-01-30): upgraded runtime to Node.js 12.x
* *3.2.1* (2020-01-27): improved scripts and SAR template reference
* ***3.2.0*** (2020-01-17): support for weighted payloads
* *3.1.2* (2020-01-17): improved optimal selection when same speed/cost
* *3.1.1* (2019-10-24): customizable least-privilege (lambdaResource CFN param)
* ***3.1.0*** (2019-10-24): $LATEST power reset and optional auto-tuning (new Optimizer step)
* ***3.0.0*** (2019-10-22): dynamic parallelism (powerValues as execution parameter)
* *2.1.3* (2019-10-22): upgraded runtime to Node.js 10.x
* *2.1.2* (2019-10-17): new balanced optimization strategy
* *2.1.1* (2019-10-10): custom domain for visualization URL
* ***2.1.0*** (2019-10-10): average statistics visualization (URL in state machine output)
* ***2.0.0*** (2019-07-28): multiple optimization strategies (cost and speed), new output format with AWS Step Functions and AWS Lambda cost
* *1.3.1* (2019-07-23): retry policies and failed invocations management
* ***1.3.0*** (2019-07-22): implemented error handling
* *1.2.1* (2019-07-22): Node.js refactor and updated IAM permissions (added lambda:UpdateAlias)
* ***1.2.0*** (2019-05-24): updated IAM permissions (least privilege for actions)
* *1.1.1* (2019-05-15): updated docs
* ***1.1.0*** (2019-05-15): cross-region invocation support
* *1.0.1* (2019-05-13): new README for SAR
* ***1.0.0*** (2019-05-13): AWS SAM refactor (published on SAR)
* *0.0.1* (2017-03-27): previous project (serverless framework)


## Contributing

Feature requests and pull requests are more than welcome!

### How to get started with local development?

For this repository, install dev dependencies with `npm install`. You can run tests with `npm test`, linting with `npm run lint`, and coverage with `npm run coverage`. Travis will automatically run the test suite on every commit and PR.
