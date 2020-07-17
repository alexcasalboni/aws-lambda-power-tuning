# How to execute the state machine

Independently of how you've deployed the state machine, you can execute it in two different ways: manually using the AWS Step Functions web console, or programmatically using the AWS CLI (or SDK).

## Execute the state machine programmatically (CLI)

You'll find a few sample scripts in the `scripts` folder.

Feel free to customize the `scripts/sample-execution-input.json`, and then run `scripts/execute.sh`.

The script will start a state machine execution, wait for the execution to complete (polling), and then show the execution results.

## Execute the state machine manually (web console)

Once the state machine is deployed, you can execute it and provide an input object.

You will find the new state machine in the [Step Functions Console](https://console.aws.amazon.com/states/) or in your SAR app's `Resources` section.

The state machine name will depend on the stack name (default: `aws-lambda-power-tuning`). Find it and click "**Start execution**".

You'll be able to provide the execution input (check the [full documentation here](README-INPUT-OUTPUT.md)]), which will look like this:

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

## Need an even simpler option?

If you don't like the two alternatives above, you could have a look at the Lumigo CLI integration which takes care of both deploying and executing the SAR app transparently. Check it out [here](README-DEPLOY.md#user-content-option-4-deploy-with-the-lumigo-cli).