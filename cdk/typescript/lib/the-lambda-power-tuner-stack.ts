import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sam from 'aws-cdk-lib/aws-sam';

export class TheLambdaPowerTunerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Custom parameters (optional)
    // let powerValues = '128,256,512,1024,1536,3008';
    // let lambdaResource = "*";
    // let visualizationURL: https://lambda-power-tuning.show/;
    // let totalExecutionTimeout: 300;
    // let permissionsBoundary: ARN;
    // let payloadS3Bucket: my-bucket;
    // let payloadS3Key: my-key.json;
    // let stateMachineNamePrefix: my-custom-name-prefix;
    

    // Deploy the aws-lambda-powertuning application from the Serverless Application Repository
    // https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:451282441545:applications~aws-lambda-power-tuning
    new sam.CfnApplication(this, 'powerTuner', {
      location: {
        applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
        semanticVersion: '4.3.6'
      },
      parameters: {
        //"lambdaResource": lambdaResource,
        //"PowerValues": powerValues,
        //"visualizationURL": visualizationURL,
        //"totalExecutionTimeout": totalExecutionTimeout,
        //"permissionsBoundary": permissionsBoundary,
        //"payloadS3Bucket": payloadS3Bucket,
        //"payloadS3Key": payloadS3Key,
        //"stateMachineNamePrefix": stateMachineNamePrefix      
      }
    })
  }
}
