# AWS Lambda Power Tuning

AWS Lambda Power Tuning is an AWS Step Functions state machine that helps you optimize your Lambda functions in a data-driven way.

The state machine is designed to be **quick** and **language agnostic**. You can provide **any Lambda function as input** and the state machine will **run it with multiple power configurations, analyze execution logs and suggest you the best configuration to minimize cost**.

The input function will be executed in your AWS account (i.e. real HTTP calls, SDK calls, cold starts, etc.). The state machine also supports cross-region access and you can enable parallel execution to generate results in just a few seconds.


## How to execute the state machine

Once the state machine and all the Lambda functions have been deployed, you can execute the state machine and provide an input object.

You will find the new state machine in the [Step Functions Console](https://console.aws.amazon.com/states/) or in your app's `Resources` section.

The state machine name will be prefixed with `powerTuningStateMachine`. Find it and click "**Start execution**". Here you can provide the execution input and an execution id (see section below for the full documentation):

```json
{
    "lambdaARN": "your-lambda-function-arn",
    "num": 10,
    "payload": "{}",
    "parallelInvocation": false,
    "strategy": "cost"
}
```

As soon as you click "**Start Execution**" again, you'll be able to visualize the execution.

Once the execution has completed, you will find the execution results in the "**Output**" tab of the "**Execution Details**" section. The output will contain the optimal power configuration and its corresponding average cost per execution.


## State Machine Input

The AWS Step Functions state machine accepts the following parameters:

* **lambdaARN** (required, string): unique identifier of the Lambda function you want to optimize
* **num** (required, integer): the # of invocations for each power configuration (minimum 5, recommended: between 10 and 100)
* **payload** (string or object): the static payload that will be used for every invocation
* **parallelInvocation** (false by default): if true, all the invocations will be executed in parallel (note: depending on the value of `num`, you may experience throttling when setting `parallelInvocation` to true)
* **strategy** (string): it can be `"cost"` or `"speed"`(the default value is `"cost"`); if you use `"cost"` the state machine will suggest the cheapest option (disregarding its performance), while if you use `"speed"` the state machine will suggest the fastest option (disregarding its cost)


## State Machine Output

The state machine will return the following output:

```json
{
  "results": {
    "power": "128",
    "cost": 2.08e-7,
    "duration": 2.9066666666666667,
    "stateMachine": {
      "executionCost": 0.00045,
      "lambdaCost": 0.0005252
    }
  }
}
```

More details on each value:

* **results.power**: the optimal power configuration (RAM)
* **results.cost**: the corresponding average cost (per invocation)
* **results.duration**: the corresponding average duration (per invocation)
* **results.stateMachine.executionCost**: the AWS Step Functions cost corresponding to this state machine execution (fixed value for "worst" case)
* **results.stateMachine.lambdaCost**: the AWS Lambda cost corresponding to this state machine execution (depending on `num` and average execution time)

## State machine cost

There are three main costs associated with AWS Lambda Power Tuning:

* **AWS Step Functions cost**: it corresponds to the number of state transitions during the state machine execution; this cost can be considered stable across executions and it's approximately $0.00045
* **AWS Lambda cost** related to your function's executions: it depends on three factors: 1) number of invocations that you configure as input (`num`), the power configurations that you are testing (`PowerValues` stack parameter), and the average invocation time of your function; for example, if you test all power configurations with `num: 100` and all invocations take less than 100ms, the Lambda cost will be approximately $0.001
* **AWS Lambda cost** related to `Initializer`, `Executor`, `Cleaner`, and `Finalizer`: for most cases it's negligible, especially if you enable `parallelInvocation: true`; this cost is not included in the `results.stateMachine` output to keep the state machine simple and easy to read and debug

## Error handling

If something goes wrong during the initialization or execution states, the `CleanUpOnError` step will be executed. All versions and alises will be deleted as expected (the same happens in the `Cleaner` step).

Note: the error `Lambda.Unknown` corresponds to unhandled errors in Lambda such as out-of-memory errors, function timeouts, and hitting the concurrent Lambda invoke limit. If you encounter it as input of `CleanUpOnError`, it's very likely that the Executor function has timed out and you'll need to enable `parallelInvocation`.

### Retry policy

The executor will retry twice in case any invocation fails. This is helpful in case of execution timeouts or memory errors. You will find the failed execution's stack trace in the `CleanUpOnError` state input.

### How do I know which executor failed and why?

You can inspect the "Execution event history" and look for the corresponding `TaskStateAborted` event type.

Additionally, you can inspect the `CleanUpOnError` state input. Here you will find the stack trace of the error.

## State Machine Internals

The AWS Step Functions state machine is composed of four Lambda functions:

* **initializer**: create N versions and aliases corresponding to the power values provided as input (e.g. 128MB, 256MB, etc.)
* **executor**: execute the given Lambda function `num` times, extract execution time from logs, and compute average cost per invocation
* **cleaner**: delete all the previously generated aliases and versions
* **finalizer**: compute the optimal power value (current logic: lowest average cost per invocation)

Initializer, cleaner and finalizer are executed only once, while the executor is used by N parallel branches of the state machine (one for each configured power value). By default, the executor will execute the given Lambda function `num` consecutive times, but you can enable parallel invocation by setting `parallelInvocation` to `true`. Please note that the total invocation time should stay below 300 seconds (5 min), which means that the average duration of your functions should stay below 3 seconds with `num=100`, 30 seconds with `num=10`, and so on.


## CHANGELOG (SAR versioning)

* *1.3.1*: retry policies and failed invocations management
* *1.3.0*: implemented error handling
* *1.2.1*: Node.js refactor and updated IAM permissions (added lambda:UpdateAlias)
* *1.2.0*: updated IAM permissions (least privilege for actions)
* *1.1.1*: updated docs
* *1.1.0*: cross-region invocation support
* *1.0.1*: new README for SAR
* *1.0.0*: AWS SAM refactor (published on SAR)
* *0.0.1*: previous project (serverless framework)