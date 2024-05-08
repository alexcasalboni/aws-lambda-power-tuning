# How to deploy the AWS Lambda Power Tuning using the CDK for Java

This CDK project deploys *AWS Lambda Power Tuning* using Java.

You can use the project as a standalone or reuse it within your own CDK projects.


## CDK Prerequisites

See [here](../README.md).


## Language specific prerequisites
- [Java Development Kit (JDK) 8 (a.k.a. 1.8) or later](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)
- [Apache Maven 3.5 or later](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites)
- [Requirements for CDK with Java](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-java.html)

## Building, testing, and deploying the app
* `mvn package`     compile and run tests
* `cdk synth`       emits the synthesized CloudFormation template
* `cdk deploy`  	deploy this app

The `cdk.json` file tells the CDK Toolkit how to execute your app.

It is a [Maven](https://maven.apache.org/) based project, so you can open this project with any Maven compatible Java IDE to build and run tests.