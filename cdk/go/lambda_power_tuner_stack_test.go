package main

import (
	"testing"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/assertions"
	"github.com/aws/jsii-runtime-go"
)

func TestLambdaPowerTunerStack(t *testing.T) {
	// GIVEN
	app := awscdk.NewApp(nil)

	// WHEN
	stack := NewLambdaPowerTunerStack(app, "MyStack", nil)

	// THEN
	template := assertions.Template_FromStack(stack, nil)

	template.HasResourceProperties(jsii.String("AWS::Serverless::Application"), map[string]interface{}{
		"Location": map[string]string{
			"ApplicationId": "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning",
		},
	})
}
