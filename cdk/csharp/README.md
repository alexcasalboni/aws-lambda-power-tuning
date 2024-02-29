# How to deploy the AWS Lambda Power Tuner tool using the CDK for C#

This CDK project deploys the *AWS Lambda Power Tuner* tool.

You can use the project as a standalone or reuse it within your own CDK projects.

## Prerequisites

- [AWS CDK Toolkit](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
- [.NET 8.0 or later](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)

See also the general [prerequisites for CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites) projects.

## Deployment

```
cd cdk/csharp
dotnet build
cdk deploy
```

## Useful commands

* `dotnet build`  compile this app
* `dotnet test`  	 test this app
* `cdk deploy`       deploy this stack to your default AWS account/region
* `cdk diff`         compare deployed stack with current state
* `cdk synth`        emits the synthesized CloudFormation template
