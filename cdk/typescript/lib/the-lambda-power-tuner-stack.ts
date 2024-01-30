import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sam from 'aws-cdk-lib/aws-sam';

export class TheLambdaPowerTunerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    let powerValues = '128,256,512,1024,1536,3008';
    let lambdaResource = "*";

    // A lambda function to use to test the powertuner
    let exampleLambda = new lambda.Function(this, 'lambdaHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromInline('exports.handler = function(event, ctx, cb) { return cb(null, "hi"); }'),
      handler: 'index.handler'
    });

    // Uncomment to only allow this power tuner to manipulate this defined function
    //lambdaResource = exampleLambda.functionArn;

    // Output the Lambda function ARN in the deploy logs to ease testing
    new cdk.CfnOutput(this, 'LambdaARN', {
      value: exampleLambda.functionArn
    })

    // Deploy the aws-lambda-powertuning application from the Serverless Application Repository
    // https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:451282441545:applications~aws-lambda-power-tuning
    new sam.CfnApplication(this, 'powerTuner', {
      location: {
        applicationId: 'arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning',
        semanticVersion: '4.2.0'
      },
      parameters: {
        "lambdaResource": lambdaResource,
        "PowerValues": powerValues
      }
    })
  }
}
