# Deploy The Lambda Power Tuner with CDK

## Overview

This is an AWS CDK project that deploys the awesome [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning) project. 

## Default Configuration Settings Provided

There are some variables that you can pass into the SAR app to manipulate the power tuning step function. You can find two that I have set for you at the top of the cdk stack

```typescript
let powerValues = '128,256,512,1024,1536,3008';
let lambdaResource = "*";
```

The `powerValues` lets you pick exactly what AWS Lambda memory settings you want to tune against. `lambdaResource` is about what IAM permissions do you want to give the state machine. By default the power tuner uses * permissions which means that it has wide scope and can tune any function. If you can scope this down to something more specific that is advisable.

## How To Deploy This Pattern

Before deploying ensure that your environment is [bootstrapped](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html). To do this run the command: 

```
cdk bootstrap aws://ACCOUNT-NUMBER-1/REGION-1
```
To synthesize the CloudFormation template that would create the stack run the command: 

```
cdk synth
```
To deploy the stack: 

```
cdk deploy
```

## How To Test This Pattern

After deployment, navigate to the step functions section of the AWS Console. From the list of availabe state machines, pick the power tuner state machine, its name would be like 'powerTuningStateMachine-*'.

Now click "Start execution" in the top right.

In the input field enter the following JSON and add in the ARN to the lambda you want to test. 
>You can either use the example lambda we bundled by getting the ARN from the cdk deploy logs or any another function in your account if you know the ARN.
```
{
  "lambdaARN": "your lambda arn to test",
  "powerValues": [
    128,
    256,
    512,
    1024,
    2048,
    3008
  ],
  "num": 10,
  "payload": {},
  "parallelInvocation": true,
  "strategy": "cost"
}
```

Click "Start Execution" in the bottom right.

When the tuner has finished your visual workflow should look like:

![state machine success](img/state-machine-success.png)

Then you can scroll down to the very last event and expand it to get the URL for your results graph:

![output](img/output.png)

## Power Tuner UI

If you want to deploy a UI to powertune your Lambda Functions rather than using the AWS Console checkout [this project](https://github.com/mattymoomoo/aws-power-tuner-ui)

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `npm run deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
