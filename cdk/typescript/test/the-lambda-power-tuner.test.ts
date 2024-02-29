import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as TheLambdaPowerTuner from '../lib/the-lambda-power-tuner-stack';

test('SAR Application Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new TheLambdaPowerTuner.TheLambdaPowerTunerStack(app, 'MyTestStack');
  // THEN

  Template.fromStack(stack).hasResourceProperties('AWS::Serverless::Application', {
    "Location":{
      "ApplicationId": "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning"
    }
  });

});