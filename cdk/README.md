# Deploy the AWS Lambda Power Tuner tool using the CDK

Here you find various CDK projects to deploy the *AWS Lambda Power Tuner* tool using your preferred programming language.

Currently we support

- [TypeScript](typescript/README.md)
- [C#](csharp/README.md)

You can use these projects as a standalone or reuse it within your own CDK projects.

## Prerequisites

- [AWS CDK Toolkit](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
- [General prerequisites for CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)

Check also the langauge specific requirements in the respective README.

## Useful commands

Run these commands from the project folders:

* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Deployment

```
cd cdk/csharp
dotnet build
cdk deploy
```
