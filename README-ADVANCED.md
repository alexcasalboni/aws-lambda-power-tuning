# Lambda Power Tuning advanced features

This section describes some advanced features of this project, as well as some considerations related to security and cost.


## Error handling

If something goes wrong during the initialization or execution states, the `CleanUpOnError` step will be executed. All temporary versions and alises will be deleted as expected (the same happens in the `Cleaner` step).

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


## Execution cost

There are three main costs associated with AWS Lambda Power Tuning:

* **AWS Step Functions cost**: it corresponds to the number of state transitions; this cost depends on the number of tested power values, and it's approximately `0.000025 * (6 + N)` where `N` is the number of power values; for example, if you test the 6 default power values, the state machine cost will be `$0.0003`
* **AWS Lambda cost** it relates to your function's executions and depends on three factors: 1) number of invocations that you configure as input (`num`), the number of tested power configurations (`powerValues`), and the average invocation time of your function; for example, if you test all the default power configurations with `num: 100` and all invocations take less than 100ms, the Lambda cost will be approximately `$0.001`
* **AWS Lambda cost** related to `Initializer`, `Executor`, `Cleaner`, and `Analyzer`: for most cases it's negligible, especially if you enable `parallelInvocation: true`; this cost is not included in the `results.stateMachine` output to keep the state machine simple and easy to read and debug


## State Machine Internals

The AWS Step Functions state machine is composed of five Lambda functions:

* **initializer**: create N versions and aliases corresponding to the power values provided as input (e.g. 128MB, 256MB, etc.)
* **executor**: execute the given Lambda function `num` times, extract execution time from logs, and compute average cost per invocation
* **cleaner**: delete all the previously generated aliases and versions
* **analyzer**: compute the optimal power value (current logic: lowest average cost per invocation)
* **optimizer**: automatically set the power to its optimal value (only if `autoOptimize` is `true`)

Initializer, cleaner, analyzer, and optimizer are executed only once, while the executor is used by N parallel branches of the state machine - one for each configured power value. By default, the executor will execute the given Lambda function `num` consecutive times, but you can enable parallel invocation by setting `parallelInvocation` to `true`.

