# How to execute the state machine

Independently of how you've deployed the state machine, you can execute it in a few different ways. Programmatically, using the AWS CLI, or AWS SDK. Manually, using the AWS Step Functions web console.

## Option 1: Execute the state machine programmatically (CLI)

You'll find a few sample scripts in the `scripts` folder.

Feel free to customize the `scripts/sample-execution-input.json`, and then run `scripts/execute.sh`.

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
    "autoOptimizeAlias": "prod"
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
    "strategy": "cost"
}
```

Click "**Start Execution**" again and the execution will start. In the next page, you'll be able to visualize the execution flow.

Once the execution has completed, you will find the execution results in the "**Output**" tab of the "**Execution Details**" section at the top of the page. The output will contain the optimal power configuration and its corresponding average cost per execution.


