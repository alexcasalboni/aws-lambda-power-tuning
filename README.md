# AWS Lambda Power Tuning
Step Functions state machine generator for AWS Lambda Power Tuning 

## How to run & deploy

First, clone this repo:
```
git clone https://github.com/alexcasalboni/aws-lambda-power-tuning.git
```

Then generate the state machine with your Account ID:

```
npm run generate -- -A 582636008125 [-R eu-west-1] [-P 128,256,512,1024]
```

Finally, you can deploy everything:

```
sls deploy
```

## State Machine Input

The AWS Step Functions state machine accepts the following parameters:

* lambdaARN (required, string): ARN of the Lambda Function you want to optimize
* num (required, integer): the # of invocations for each power configuration (recommended: between 10 and 100)
* payload (string or object): the static payload that will be used for every invocation
* enableParallel (false by default): if true, all the invocations will be executed in parallel (note: depending on the value of `num`, you may experience throttling when setting `enableParallel` to true)


## State Machine Output

* power: the optimal power configuration
* cost: the corresponding average cost (per invocation)


## Contributing
Contributors and PRs are always welcome!

### Testing

Run `npm test`.