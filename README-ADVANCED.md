# Lambda Power Tuning advanced features

This section describes some advanced features of this project, as well as some considerations related to security and cost.


## Error handling

If something goes wrong during the initialization or execution states, the `CleanUpOnError` step will be executed. All temporary versions and aliases will be deleted as expected (the same happens in the `Cleaner` step).

You can customize the `totalExecutionTimeout` parameter at deploy time (up to 15min). This parameter will be used both for Lambda function timeouts and Step Function tasks timeouts. In case the `Executor` raises a timeout error, you will see a `States.Timeout` error. Keep in mind that the timeout you configure will vary whether you're setting `parallelInvocation` to `true` or `false`. When you enable parallel invocation, all the function executions will run concurrently (rather than in series) so that you can keep that timeout lower and your overall state machine execution faster.

In all other error cases, you will see a `Lambda.Unknown` error, which corresponds to unhandled errors in Lambda such as out-of-memory errors and hitting the concurrent Lambda invoke limit. If you encounter it as input of `CleanUpOnError`, it's very likely that something went wrong with the function you're power-tuning.

### Retry policy

The executor will retry twice in case any invocation fails. This is helpful in case of execution timeouts or memory errors. You will find the failed execution's stack trace in the `CleanUpOnError` state input.

### How do I know which executor failed and why?

You can inspect the "Execution event history" and look for the corresponding `TaskStateAborted` event type.

Additionally, you can inspect the `CleanUpOnError` state input. Here you will find the stack trace of the error.


## Security

All the IAM roles used by the state machine adopt the least privilege best practice, meaning that only a minimal set of `Actions` are granted to each Lambda function.

For example, the Executor function can only call `lambda:InvokeFunction`. The Analyzer function doesn't require any permission at all. On the other hand, the Initializer, Cleaner, and Optimizer functions require a broader set of actions.

By default, the Executor function is allowed to invoke any Lambda function in your account, in any region. This happens because the default resource defined in the IAM role is `"*"`, but you can change this value at deploy-time, via the the `lambdaResource` CloudFormation parameter.

For example, you could use a mix of the following:

* Same-region prefix: `arn:aws:lambda:us-east-1:*:function:*`
* Function name prefix: `arn:aws:lambda:*:*:function:my-prefix-*`
* Function name suffix: `arn:aws:lambda:*:*:function:*-dev`
* By account ID: `arn:aws:lambda:*:ACCOUNT_ID:function:*`

### LMI permissions

The LMI-related functions require broader permissions than the standard functions because they manage EC2 capacity providers and temporary Lambda functions. Specifically:

* **lmiSetup** needs permissions to create/delete capacity providers, create functions, pass IAM roles, and create service-linked roles
* **lmiExecutor** needs permissions to invoke functions, update function configuration, and pass capacity providers
* **lmiReady** needs permissions to read function configuration and put scaling config
* **lmiCleaner** needs permissions to delete functions and capacity providers

These functions use `Resource: '*'` because capacity provider ARNs and temporary function ARNs are not known at deploy time. The `lambdaResource` parameter does not restrict LMI functions.


## Execution cost

There are three main costs associated with AWS Lambda Power Tuning:

* **AWS Step Functions cost**: it corresponds to the number of state transitions; this cost depends on the number of tested power values, and it's approximately `0.000025 * (6 + N)` where `N` is the number of power values; for example, if you test the 6 default power values, the state machine cost will be `$0.0003`
* **AWS Lambda cost** it relates to your function's executions and depends on three factors: 1) number of invocations that you configure as input (`num`), the number of tested power configurations (`powerValues`), and the average invocation time of your function; for example, if you test all the default power configurations with `num: 100` and all invocations take less than 100ms, the Lambda cost will be approximately `$0.001`
* **AWS Lambda cost** related to `Initializer`, `Executor`, `Cleaner`, and `Analyzer`: for most cases it's negligible, especially if you enable `parallelInvocation: true`; this cost is not included in the `results.stateMachine` output to keep the state machine simple and easy to read and debug

### LMI execution cost

When using LMI tuning, there are additional costs:

* **EC2 instance cost**: the capacity provider provisions EC2 instances for the duration of the test, plus a 15% AWS management fee. Pricing is fetched automatically from the AWS Pricing API (e.g. c8g.xlarge is ~$0.16/hr in us-west-2). When testing multiple instance types, each runs sequentially with its own capacity provider — a typical 5-15 minute test per instance type would cost a few cents
* **Lambda request cost**: $0.20 per million invocations during the sustained load test
* **Important**: if a test fails mid-execution, the cleanup step will automatically delete the capacity provider and temporary function to prevent ongoing EC2 charges


## State Machine Internals

The AWS Step Functions state machine is composed of five core Lambda functions for standard power tuning:

* **Initializer**: define all the versions and aliases that need to be created (see Publisher below)
* **Publisher**: create a new version and aliases corresponding to one of the power values provided as input (e.g. 128MB, 256MB, etc.)
* **IsCountReached**: go back to Publisher until all the versions and aliases have been created
* **Executor**: execute the given Lambda function `num` times, extract execution time from logs, and compute average cost per invocation
* **Cleaner**: delete all the previously generated aliases and versions
* **Analyzer**: compute the optimal power value (current logic: lowest average cost per invocation)
* **Optimizer**: automatically set the power to its optimal value (only if `autoOptimize` is `true`)

Initializer, Cleaner, Analyzer, and Optimizer are invoked only once, while the Publisher and Executor are invoked multiple times. Publisher is used in a loop to create all the required versions and aliases, which depend on the values of `num`, `powerValues`, and `onlyColdStarts`. Executor is used by N parallel branches - one for each configured power value. By default, the Executor will invoke the given Lambda function `num` consecutive times, but you can enable parallel invocation by setting `parallelInvocation` to `true`.

### LMI internals

When `lmiConfig` is provided, the state machine uses five additional Lambda functions for [Lambda Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html) tuning:

* **LmiInitializer**: validates the LMI configuration, fetches EC2 pricing from the AWS Pricing API, and builds the test matrix for all instance types
* **LmiSetup**: creates an EC2 capacity provider and a temporary Lambda function configured to use it
* **LmiReady**: waits for the capacity provider to finish provisioning EC2 instances
* **LmiExecutor**: runs sustained load tests across each memory-per-vCPU and concurrency combination, detecting performance degradation and stopping early when latency increases beyond the configured threshold
* **LmiCleaner**: deletes the temporary function and capacity provider to stop EC2 charges

When multiple instance types are configured, the state machine wraps the LmiSetup → LmiReady → LmiExecutor → LmiCleaner flow in an outer Map state with `MaxConcurrency: 1`, iterating sequentially over each instance type. Each instance type gets its own capacity provider, and all resources are cleaned up before moving to the next.

In combined mode (both `powerValues` and `lmiConfig` provided), the standard tuning runs first, then the LMI tuning runs sequentially. The Analyzer receives results from both and selects the overall optimal configuration.

## Weighted Payloads

> [!IMPORTANT]
> Your payload will only be treated as a weighted payload if it adheres to the JSON structure that follows. Otherwise, it's assumed to be an array-shaped payload.

Weighted payloads can be used in scenarios where the payload structure and the corresponding performance/speed could vary a lot in production and you'd like to include multiple payloads in the tuning process.

You may want to use weighted payloads also in case of functions with side effects that would be hard or impossible to test with the very same payload (for example, a function that deletes records from a database).

You configure weighted payloads as follows:

```json
{
    ...
    "num": 50,
    "payload": [
        { "payload": {...}, "weight": 5 },
        { "payload": {...}, "weight": 15 },
        { "payload": {...}, "weight": 30 }
    ]
}
```

In the example above, the weights `5`, `15`, and `30` are used as relative weights. They will correspond to `10%` (5 out of 50), `30%` (15 out of 50), and `60%` (30 out of 50) respectively - meaning that the corresponding payload will be used 10%, 30% and 60% of the time.

For example, if `num=100` the first payload will be used 10 times, the second 30 times, and the third 60 times.

To simplify these calculations, you could use weights that sum up to 100.

Note: the number of weighted payloads must always be smaller or equal than `num` (or `num >= count(payloads)`). For example, if you have 50 weighted payloads, you'll need to set at least `num: 50` so that each payload will be used at least once.


## Pre/Post-processing functions

Sometimes you need to power-tune Lambda functions that have side effects such as creating or deleting records in a database. In these cases, you may need to execute some pre-processing or post-processing logic before and/or after each function invocation.

For example, imagine that you are power-tuning a function that deletes one record from a downstream database. Since you want to execute this function `num` times you'd need to insert some records in advance and then find a way to delete all of them with a dynamic payload. Or you could simply configure a pre-processing function (using the `preProcessorARN` input parameter) that will create a brand new record before the actual function is executed.

Here's the flow in pseudo-code:

```
function Executor:
  iterate from 0 to num:
    [payload = execute Pre-processor (payload)]
    results = execute Main Function (payload)
    [execute Post-processor (results)]
```

Please also keep in mind the following:

* You can configure a pre-processor and/or a post-processor independently
* The pre-processor will receive the original payload
* If the pre-processor returns a non-empty output, it will overwrite the original payload
* The post-processor will receive the main function's output as payload
* If a pre-processor or post-processor fails, the whole power-tuning state machine will fail
* Pre/post-processors don't have to be in the same region of the main function
* Pre/post-processors don't alter the statistics related to cost and performance

## S3 payloads

In case of very large payloads above 256KB, you can provide an S3 object reference (`s3://bucket/key`) instead of an inline payload.

Your state machine input will look like this:

```json
{
    "lambdaARN": "your-lambda-function-arn",
    "powerValues": [128, 256, 512, 1024],
    "num": 50,
    "payloadS3": "s3://your-bucket/your-object.json"
}
```

Please note that the state machine will require IAM access to your S3 bucket, so you might need to redeploy the Lambda Power Tuning application and configure the `payloadS3Bucket` parameter at deployment time. This will automatically generate a custom IAM managed policy to grant read-only access to that bucket. If you want to narrow down the read-only policy to a specific object or pattern, use the `payloadS3Key` parameter (which is `*` by default).

S3 payloads work fine with weighted payloads too.
