# How to execute the state machine

Independently of how you've deployed the state machine, you can execute it in a few different ways. Programmatically, using the AWS CLI, or AWS SDK. Manually, using the AWS Step Functions web console.

## Option 1: Execute the state machine programmatically (CLI)

You'll find a few sample scripts in the `scripts` folder.

Feel free to customize the `scripts/sample-execution-input.json` or add a new json file, and then run `scripts/execute.sh [input json]` by default if input json is not passed then the script will default to `sample-execution-input.json`.

The script will start a state machine execution, wait for the execution to complete (polling), and then show the execution results.

### Usage in CI/CD pipelines

If you want to run the state machine as part of your continuous integration pipeline and automatically fine-tune your functions at every deployment, you can execute it with the script `scripts/execute.sh` (or similar) by providing the following input parameters:

```json
{
    "lambdaARN": "...",
    "num": 10,
    "payload": {},
    "powerValues": [128, 256, 512, ...],
    "autoOptimize": true,
    "autoOptimizeAlias": "prod",
    "allowedExceptions": ["HandledError"]
}
```

You can use different alias names such as `dev`, `test`, `production`, etc. If you don't configure any alias name, the state machine will only update the `$LATEST` alias.

## Option 2: Execute the state machine manually (web console)

Once the state machine is deployed, you can execute it and provide an input object.

You will find the new state machine in the [Step Functions Console](https://console.aws.amazon.com/states/) or in your SAR app's `Resources` section.

The state machine name will depend on the stack name (default: `aws-lambda-power-tuning`). Find it and click "**Start execution**".

You'll be able to provide the execution input (check the [full documentation here](README.md#state-machine-input-at-execution-time)), which will look like this:

```json
{
    "lambdaARN": "your-lambda-function-arn",
    "powerValues": [128, 256, 512, 1024, 1536, 2048, 3008],
    "num": 50,
    "payload": {},
    "parallelInvocation": true,
    "strategy": "cost",
    "allowedExceptions": ["HandledError"]
}
```

Click "**Start Execution**" again and the execution will start. In the next page, you'll be able to visualize the execution flow.

Once the execution has completed, you will find the execution results in the "**Output**" tab of the "**Execution Details**" section at the top of the page. The output will contain the optimal power configuration and its corresponding average cost per execution.

## State machine input (at execution time)

Each execution of the state machine will require an input where you can define the following input parameters:

|           <div style="width:260px">**Parameter**</div>            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|:-----------------------------------------------------------------:|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|         **lambdaARN** (required)<br/>type: _string_<br/>          | Unique identifier of the Lambda function you want to optimize.                                                                                                                                                                                                                                                                                                                                                                                            |
|              **num** (required)<br/>type: _integer_               | The # of invocations for each power configuration (minimum 5, recommended: between 10 and 100).                                                                                                                                                                                                                                                                                                                                                           |
|      **powerValues**<br/>type: _string or list of integers_       | The list of power values to be tested; if not provided, the default values configured at deploy-time are used; you can provide any power values between 128MB and 10,240MB. ⚠️ New AWS accounts have reduced concurrency and memory quotas (3008MB max).                                                                                                                                                                                                  |
|          **payload**<br/>type: _string, object, or list_          | The static payload that will be used for every invocation (object or string); when using a list, a weighted payload is expected in the shape of `[{"payload": {...}, "weight": X }, {"payload": {...}, "weight": Y }, {"payload": {...}, "weight": Z }]`, where the weights `X`, `Y`, and `Z` are treated as relative weights (not percentages); more details in the [Weighted Payloads section](README-ADVANCED.md#user-content-weighted-payloads).      |
|                 **payloadS3**<br/>type: _string_                  | An Amazon S3 object reference for large payloads (>256KB), formatted as `s3://bucket/key`; it requires read-only IAM permissions, see `payloadS3Bucket` and `payloadS3Key` below and find more details in the [S3 payloads section](README-ADVANCED.md#user-content-s3-payloads).                                                                                                                                                                         |
|  **parallelInvocation**<br/>type: _boolean_<br/>default: `false`  | If true, all the invocations will run in parallel. ⚠️ Note: depending on the value of `num`, you might experience throttling.                                                                                                                                                                                                                                                                                                                             |
|       **strategy**<br/>type: _string_<br/>default: `"cost"`       | It can be `"cost"` or `"speed"` or `"balanced"`; if you use `"cost"` the state machine will suggest the cheapest option (disregarding its performance), while if you use `"speed"` the state machine will suggest the fastest option (disregarding its cost). When using `"balanced"` the state machine will choose a compromise between `"cost"` and `"speed"` according to the parameter `"balancedWeight"`.                                            |
|     **balancedWeight**<br/>type: _number_<br/>default: `0.5`      | Parameter that represents the trade-off between cost and speed. Value is between 0 and 1, where 0.0 is equivalent to `"speed"` strategy, 1.0 is equivalent to `"cost"` strategy.                                                                                                                                                                                                                                                                          |
|     **autoOptimize**<br/>type: _boolean_<br/>default: `false`     | If true, the state machine will apply the optimal configuration at the end of its execution.                                                                                                                                                                                                                                                                                                                                                              |
|             **autoOptimizeAlias**<br/>type: _string_              | If provided - and only if `autoOptimize` is true, the state machine will create or update this alias with the new optimal power value.                                                                                                                                                                                                                                                                                                                    |
|        **dryRun**<br/>type: _boolean_<br/>default: `false`        | If true, the state machine will invoke the input function only once and disable every functionality related to logs analysis, auto-tuning, and visualization; this is intended for testing purposes, for example to verify that IAM permissions are set up correctly.                                                                                                                                                                                     |
|              **preProcessorARN**<br/>type: _string_               | The ARN of a Lambda function that will be invoked before every invocation of `lambdaARN`; more details in the [Pre/Post-processing functions section](README-ADVANCED.md#user-content-prepost-processing-functions).                                                                                                                                                                                                                                      |
|              **postProcessorARN**<br/>type: _string_              | The ARN of a Lambda function that will be invoked after every invocation of `lambdaARN`; more details in the [Pre/Post-processing functions section](README-ADVANCED.md#user-content-prepost-processing-functions).                                                                                                                                                                                                                                       |
|    **discardTopBottom**<br/>type: _number_<br/>default: `0.2`     | By default, the state machine will discard the top/bottom 20% of "outlier invocations" (the fastest and slowest) to filter out the effects of cold starts and remove any bias from overall averages. You can customize this parameter by providing a value between 0 and 0.4, where 0 means no results are discarded and 0.4 means 40% of the top/bottom results are discarded (i.e. only 20% of the results are considered).                             |
|            **sleepBetweenRunsMs**<br/>type: _integer_             | If provided, the time in milliseconds that the tuner will sleep/wait after invoking your function, but before carrying out the Post-Processing step, should that be provided. This could be used if you have aggressive downstream rate limits you need to respect. By default this will be set to 0 and the function won't sleep between invocations. This has no effect if running the invocations in parallel.                                         |
|  **disablePayloadLogs**<br/>type: _boolean_<br/>default: `false`  | If true, suppresses `payload` from error messages and logs. If `preProcessorARN` is provided, this also suppresses the output payload of the pre-processor.                                                                                                                                                                                                                                                                                               |
| **includeOutputResults**<br/>type: _boolean_<br/>default: `false` | If true, the average cost and average duration for every power value configuration will be included in the state machine output.                                                                                                                                                                                                                                                                                                                          |
|    **onlyColdStarts**<br/>type: _boolean_<br/>default: `false`    | If true, the tool will force all invocations to be cold starts. The initialization phase will be considerably slower as `num` versions/aliases need to be created for each power value.                                                                                                                                                                                                                                                                   |
| **allowedExceptions"<br/>type: _list_<br/>default: `[]`           | Set Errors that will be handlded be the executor rather than causing it to error out.                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                |