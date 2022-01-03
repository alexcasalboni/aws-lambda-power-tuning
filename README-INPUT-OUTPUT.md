# State Machine Input and Output

Each execution of the state machine will require an input and will provide the corresponding output.


## State machine input (at execution time)

The state machine accepts the following intput parameters:

* **lambdaARN** (required, string): unique identifier of the Lambda function you want to optimize
* **powerValues** (optional, string or list of integers): the list of power values to be tested; if not provided, the default values configured at deploy-time are used (by default: 128MB, 256MB, 512MB, 1024MB, 1536MB, and 3008MB); you can provide any power values between 128MB and 10,240MB
* **num** (required, integer): the # of invocations for each power configuration (minimum 5, recommended: between 10 and 100)
* **payload** (string, object, or list): the static payload that will be used for every invocation (object or string); when using a list, a weighted payload is expected in the shape of `[{"payload": {...}, "weight": X }, {"payload": {...}, "weight": Y }, {"payload": {...}, "weight": Z }]`, where the weights `X`, `Y`, and `Z` are treated as relative weights (not perentages); more details below in the [Weighted Payloads section](#user-content-weighted-payloads)
* **payloadS3** (string): a reference to Amazon S3 for large payloads (>256KB), formatted as `s3://bucket/key`; it requires read-only IAM permissions, see `payloadS3Bucket` and `payloadS3Key` below and find more details in the [S3 payloads section](#user-content-s3-payloads)
* **parallelInvocation** (false by default): if true, all the invocations will be executed in parallel (note: depending on the value of `num`, you may experience throttling when setting `parallelInvocation` to true)
* **strategy** (string): it can be `"cost"` or `"speed"` or `"balanced"` (the default value is `"cost"`); if you use `"cost"` the state machine will suggest the cheapest option (disregarding its performance), while if you use `"speed"` the state machine will suggest the fastest option (disregarding its cost). When using `"balanced"` the state machine will choose a compromise between `"cost"` and `"speed"` according to the parameter `"balancedWeight"`
* **balancedWeight** (number between 0.0 and 1.0, by default is 0.5): parameter that express the trade-off between cost and time, 0.0 is equivalent to `"speed"` strategy, 1.0 is equivalent to `"cost"` strategy
* **autoOptimize** (false by default): if `true`, the state machine will apply the optimal configuration at the end of its execution
* **autoOptimizeAlias** (string): if provided - and only if `autoOptimize` if `true`, the state machine will create or update this alias with the new optimal power value
* **dryRun** (false by default): if true, the state machine will execute the input function only once and it will disable every functionality related to logs analysis, auto-tuning, and visualization; the dry-run mode is intended for testing purposes, for example to verify that IAM permissions are set up correctly
* **preProcessorARN** (string): it must be the ARN of a Lambda function; if provided, the function will be invoked before every invocation of `lambdaARN`; more details below in the [Pre/Post-processing functions section](#user-content-prepost-processing-functions)
* **postProcessorARN** (string): it must be the ARN of a Lambda function; if provided, the function will be invoked after every invocation of `lambdaARN`; more details below in the [Pre/Post-processing functions section](#user-content-prepost-processing-functions)


## State machine configuration (at deployment time)

The CloudFormation template accepts the following parameters:

* **PowerValues** (list of numbers): these power values will be used as the default in case no `powerValues` input parameter is provided at execution time
* **visualizationURL** (string): the base URL for the visualization tool, by default it's `lambda-power-tuning.show` but you could use your own custom tool
* **totalExecutionTimeout** (number in seconds, default=`300`): the timeout in seconds applied to all functions of the state machine
* **lambdaResource** (string, default=`*`): the `Resource` used in IAM policies; it's `*` by default but you could restrict it to a prefix or a specific function ARN
* **permissionsBoundary** (string): the ARN of a permissions boundary (policy), applied to all functions of the state machine
* **payloadS3Bucket** (string): the S3 bucket name used for large payloads (>256KB); if provided, it's added to a custom managed IAM policy that grants read-only permission to the S3 bucket; more details below in the [S3 payloads section](#user-content-s3-payloads)
* **payloadS3Key** (string, default=`*`): they S3 object key used for large payloads (>256KB); the default value grants access to all S3 objects in the bucket specified with `payloadS3Bucket`; more details below in the [S3 payloads section](#user-content-s3-payloads)

Please note that the total execution time should stay below 300 seconds (5 min), which is the default timeout. You can easily estimate the total execution timout based on the average duration of your functions. For example, if your function's average execution time is 5 seconds and you haven't enabled `parallelInvocation`, you should set `totalExecutionTimeout` to at least `num * 5`: 50 seconds if `num=10`, 500 seconds if `num=100`, and so on. If you have enabled `parallelInvocation`, usually you don't need to tune the value of `totalExecutionTimeout` unless your average execution time is above 5 min.

### Usage in CI/CD pipelines

If you want to run the state machine as part of your continuous integration pipeline and automatically fine-tune your functions at every deployment, you can execute it with the script `scripts/execute.sh` (or similar) by providing the following input parameters:

```json
{
    "lambdaARN": "...",
    "num": 10,
    "payload": {},
    "powerValues": [128, 256, 512, ...],
    "autoOptimize": true,
    "autoOptimizeAlias": "prod"
}
```

You can use different alias names such as `dev`, `test`, `production`, etc. If you don't configure any alias name, the state machine will only update the `$LATEST` alias.


### Weighted Payloads

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


### Pre/Post-processing functions

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

### S3 payloads

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
* **results.stateMachine.visualization**: if you visit this autogenerated URL, you will be able to visualize and inspect average statistics about cost and performance; important note: average statistics are NOT shared with the server since all the data is encoded in the URL hash ([example](https://lambda-power-tuning.show/#gAAAAQACAAQABsAL;ZooQR4yvkUa/pQRGRC5zRaADHUVjOftE;QdWhOEMkoziDT5Q4xhiIOMYYiDi6RNc4)), which is available only client-side

