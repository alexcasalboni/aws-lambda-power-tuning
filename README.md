# AWS Lambda Power Tuning

[![Build Status](https://travis-ci.com/alexcasalboni/aws-lambda-power-tuning.svg?branch=master)](https://app.travis-ci.com/github/alexcasalboni/aws-lambda-power-tuning)
[![Coverage Status](https://coveralls.io/repos/github/alexcasalboni/aws-lambda-power-tuning/badge.svg)](https://coveralls.io/github/alexcasalboni/aws-lambda-power-tuning)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/alexcasalboni/aws-lambda-power-tuning/graphs/commit-activity)
[![GitHub issues](https://img.shields.io/github/issues/alexcasalboni/aws-lambda-power-tuning.svg)](https://github.com/alexcasalboni/aws-lambda-power-tuning/issues)
[![Open Source Love svg2](https://badges.frapsoft.com/os/v2/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badges/)

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

# State Machine Input and Output

Each execution of the state machine will require an input and will provide the corresponding output.

### State machine configuration (at deployment time)

The CloudFormation template accepts the following parameters

|                    <div style="width:260px">**Parameter**</div>                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                   |
|:-----------------------------------------------------------------------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **PowerValues**<br>type: _list of numbers_<br>default: [128,256,512,1024,1536,3008] | These power values (in MB) will be used as the default in case no `powerValues` input parameter is provided at execution time                                                                                                                                                                                                                                                                                                 | |
|    **visualizationURL**<br>type: _string_<br>default: `lambda-power-tuning.show`    | The base URL for the visualization tool, you can bring your own visualization tool                                                                                                                                                                                                                                                                                                                                            |
|            **totalExecutionTimeout**<br>type: _number_<br>default: `300`            | The timeout in seconds applied to all functions of the state machine                                                                                                                                                                                                                                                                                                                                                          |
|                **lambdaResource**<br>type: _string_<br>default: `*`                 | The `Resource` used in IAM policies; it's `*` by default but you could restrict it to a prefix or a specific function ARN                                                                                                                                                                                                                                                                                                     |
|                    **permissionsBoundary**<br>type: _string_<br>                    | The ARN of a permissions boundary (policy), applied to all functions of the state machine                                                                                                                                                                                                                                                                                                                                     |
|                      **payloadS3Bucket**<br>type: _string_<br>                      | The S3 bucket name used for large payloads (>256KB); if provided, it's added to a custom managed IAM policy that grants read-only permission to the S3 bucket; more details below in the[S3 payloads section](#user-content-s3-payloads)                                                                                                                                                                                      |
|                 **payloadS3Key**<br>type: _string_<br>default: `*`                  | The S3 object key used for large payloads (>256KB); the default value grants access to all S3 objects in the bucket specified with `payloadS3Bucket`; more details below in the [S3 payloads section](#user-content-s3-payloads)                                                                                                                                                                                              |
|                       **layerSdkName**<br>type: _string_<br>                        | The name of the SDK layer, in case you need to customize it (optional)                                                                                                                                                                                                                                                                                                                                                        |
|            **logGroupRetentionInDays**<br>type: _number_<br>default: `7`            | The number of days to retain log events in the Lambda log groups. Before this parameter existed, log events were retained indefinitely                                                                                                                                                                                                                                                                                        |
|            **securityGroupIds**<br>type: _list of SecurityGroup IDs_<br>            | List of Security Groups to use in every Lambda function's VPC Configuration (optional); please note that your VPC should be configured to allow public internet access (via NAT Gateway) or include VPC Endpoints to the Lambda service                                                                                                                                                                                       |
|                   **subnetIds**<br>type: _list of Subnet IDs_<br>                   | List of Subnets to use in every Lambda function's VPC Configuration (optional); please note that your VPC should be configured to allow public internet access (via NAT Gateway) or include VPC Endpoints to the Lambda service                                                                                                                                                                                               |
| **stateMachineNamePrefix**<br>type: _string_<br>default: `powerTuningStateMachine`  | Allows you to customize the name of the state machine. Maximum 43 characters, only alphanumeric (plus `-` and `_`). The last portion of the `AWS::StackId` will be appended to this value, so the full name will look like `powerTuningStateMachine-89549da0-a4f9-11ee-844d-12a2895ed91f`. Note: `StateMachineName` has a maximum of 80 characters and 36+1 from the `StackId` are appended, allowing 43 for a custom prefix. |

Please note that the total execution time should stay below 300 seconds (5 min), which is the default timeout. You can easily estimate the total execution timeout based on the average duration of your functions. For example, if your function's average execution time is 5 seconds and you haven't enabled `parallelInvocation`, you should set `totalExecutionTimeout` to at least `num * 5`: 50 seconds if `num=10`, 500 seconds if `num=100`, and so on. If you have enabled `parallelInvocation`, usually you don't need to tune the value of `totalExecutionTimeout` unless your average execution time is above 5 min. If you have a sleep between invocations set, you should include that in your timeout calculations.

## How to execute the state machine

You can execute the state machine manually or programmatically, see the documentation [here](README-EXECUTE.md).

You can execute the state machine manually or programmatically, see the documentation [here](README-EXECUTE.md).

### State machine input (at execution time)

Each execution of the state machine will require an input where you can define the following input parameters:

|           <div style="width:260px">**Parameter**</div>            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|:-----------------------------------------------------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|         **lambdaARN** (required)<br/>type: _string_<br/>          | Unique identifier of the Lambda function you want to optimize                                                                                                                                                                                                                                                                                                                                                                                             |
|              **num** (required)<br/>type: _integer_               | The # of invocations for each power configuration (minimum 5, recommended: between 10 and 100)                                                                                                                                                                                                                                                                                                                                                            |
|      **powerValues**<br/>type: _string or list of integers_       | The list of power values to be tested; if not provided, the default values configured at deploy-time are used; you can provide any power values between 128MB and 10,240MB (⚠️ New AWS accounts have reduced concurrency and memory quotas (3008MB max))                                                                                                                                                                                                  |
|          **payload**<br/>type: _string, object, or list_          | The static payload that will be used for every invocation (object or string); when using a list, a weighted payload is expected in the shape of `[{"payload": {...}, "weight": X }, {"payload": {...}, "weight": Y }, {"payload": {...}, "weight": Z }]`, where the weights `X`, `Y`, and `Z` are treated as relative weights (not percentages); more details below in the [Weighted Payloads section](README-ADVANCED.md#user-content-weighted-payloads) |
|                 **payloadS3**<br/>type: _string_                  | A reference to Amazon S3 for large payloads (>256KB), formatted as `s3://bucket/key`; it requires read-only IAM permissions, see `payloadS3Bucket` and `payloadS3Key` below and find more details in the [S3 payloads section](README-ADVANCED.md#user-content-s3-payloads)                                                                                                                                                                               |
|  **parallelInvocation**<br/>type: _boolean_<br/>default: `false`  | If true, all the invocations will be executed in parallel (note: depending on the value of `num`, you may experience throttling when setting `parallelInvocation` to true)                                                                                                                                                                                                                                                                                |
|       **strategy**<br/>type: _string_<br/>default: `"cost"`       | It can be `"cost"` or `"speed"` or `"balanced"`; if you use `"cost"` the state machine will suggest the cheapest option (disregarding its performance), while if you use `"speed"` the state machine will suggest the fastest option (disregarding its cost). When using `"balanced"` the state machine will choose a compromise between `"cost"` and `"speed"` according to the parameter `"balancedWeight"`                                             |
|     **balancedWeight**<br/>type: _number_<br/>default: `0.5`      | Parameter that express the trade-off between cost and time. Value is between 0 & 1, 0.0 is equivalent to `"speed"` strategy, 1.0 is equivalent to `"cost"` strategy                                                                                                                                                                                                                                                                                       |
|     **autoOptimize**<br/>type: _boolean_<br/>default: `false`     | If `true`, the state machine will apply the optimal configuration at the end of its execution                                                                                                                                                                                                                                                                                                                                                             |
|             **autoOptimizeAlias**<br/>type: _string_              | If provided - and only if `autoOptimize` if `true`, the state machine will create or update this alias with the new optimal power value                                                                                                                                                                                                                                                                                                                   |
|        **dryRun**<br/>type: _boolean_<br/>default: `false`        | If true, the state machine will execute the input function only once and it will disable every functionality related to logs analysis, auto-tuning, and visualization; the dry-run mode is intended for testing purposes, for example to verify that IAM permissions are set up correctly                                                                                                                                                                 |
|              **preProcessorARN**<br/>type: _string_               | It must be the ARN of a Lambda function; if provided, the function will be invoked before every invocation of `lambdaARN`; more details below in the [Pre/Post-processing functions section](README-ADVANCED.md#user-content-prepost-processing-functions)                                                                                                                                                                                                |
|              **postProcessorARN**<br/>type: _string_              | It must be the ARN of a Lambda function; if provided, the function will be invoked after every invocation of `lambdaARN`; more details below in the [Pre/Post-processing functions section](README-ADVANCED.md#user-content-prepost-processing-functions)                                                                                                                                                                                                 |
|    **discardTopBottom**<br/>type: _number_<br/>default: `0.2`     | By default, the state machine will discard the top/bottom 20% of "outliers" (the fastest and slowest), to filter out the effects of cold starts that would bias the overall averages. You can customize this parameter by providing a value between 0 and 0.4, with 0 meaning no results are discarded and 0.4 meaning that 40% of the top/bottom results are discarded (i.e. only 20% of the results are considered).                                    |
|            **sleepBetweenRunsMs**<br/>type: _integer_             | If provided, the time in milliseconds that the tuner function will sleep/wait after invoking your function, but before carrying out the Post-Processing step, should that be provided. This could be used if you have aggressive downstream rate limits you need to respect. By default this will be set to 0 and the function won't sleep between invocations. Setting this value will have no effect if running the invocations in parallel.            |
|  **disablePayloadLogs**<br/>type: _boolean_<br/>default: `false`  | If provided and set to a truthy value, suppresses `payload` from error messages and logs. If `preProcessorARN` is provided, this also suppresses the output payload of the pre-processor.                                                                                                                                                                                                                                                                 |
| **includeOutputResults**<br/>type: _boolean_<br/>default: `false` | If provided and set to true, the average cost and average duration for every power value configuration will be included in the state machine output.                                                                                                                                                                                                                                                                                                      |

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

## State Machine Output

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

## Additional features, considerations, and internals

[Here](README-ADVANCED.md) you can find out more about some advanced features of this project, its internals, and some considerations about security and execution cost.

## Contributing

Feature requests and pull requests are more than welcome!

### How to get started with local development?

For this repository, install dev dependencies with `npm install`. You can run tests with `npm test`, linting with `npm run lint`, and coverage with `npm run coverage`. Unit tests will run automatically on every commit and PR.
