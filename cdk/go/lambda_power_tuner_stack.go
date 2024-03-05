package main

import (
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssam"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type LambdaPowerTunerStackProps struct {
	awscdk.StackProps
}

func NewLambdaPowerTunerStack(scope constructs.Construct, id string, props *LambdaPowerTunerStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	awssam.NewCfnApplication(stack, jsii.String("powerTuner"), &awssam.CfnApplicationProps{
		Location: map[string]string{
			"applicationId":   "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning",
			"semanticVersion": "4.3.4",
		},
		Parameters: map[string]string{
			// "lambdaResource": "*",
			// "PowerValues": "128,256,512,1024,1536,3008",
			// "visualizationURL": "https://lambda-power-tuning.show/",
			// "totalExecutionTimeout": "300",
			// "payloadS3Key": "*",
			// "logGroupRetentionInDays": "7",
			// "stateMachineNamePrefix": "powerTuningStateMachine",
			// "permissionsBoundary": "<ARN of permission boundary>",
			// "payloadS3Bucket": "<S3 bucket name used for large payloads>",
			// "layerSdkName": "<name of the SDK layer>",
			// "securityGroupIds": "<List of Security Groups to use in every Lambda function's VPC Configuration>",
			// "subnetIds": "<List of Subnets to use in every Lambda function's VPC Configuration>"
		},
	})

	return stack
}
