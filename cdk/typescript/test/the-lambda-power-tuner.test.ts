import { expect as expectCDK, haveResourceLike } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as TheLambdaPowerTuner from '../lib/the-lambda-power-tuner-stack';

test('SAR Application Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new TheLambdaPowerTuner.TheLambdaPowerTunerStack(app, 'MyTestStack');
  // THEN
  expectCDK(stack).to(haveResourceLike("AWS::Serverless::Application", {
    "Location": {
      "ApplicationId": "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning",
      "SemanticVersion": "4.2.0"
    }
  }));
});
