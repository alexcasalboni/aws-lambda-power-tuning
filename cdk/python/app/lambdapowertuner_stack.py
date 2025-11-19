from aws_cdk import (    
    Stack   
)
from constructs import Construct

from aws_cdk import aws_sam as sam



class TheLambdaPowerTunerStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # The code that defines your stack goes here

       
        stateMachineConfiguration= {
            # "lambdaResource": "*",
            # "PowerValues": "128,256,512,1024,1536,3008",
            # "visualizationURL": "https://lambda-power-tuning.shw/",
            # "totalExecutionTimeout": "300",
            # "payloadS3Key": "*",
            # "logGroupRetentionInDays": "7",
            # "stateMachineNamePrefix": "powerTuningStateMachine",
            # "permissionsBoundary": "<ARN of permission boundary>",
            # "payloadS3Bucket": "<S3 bucket name used for large payloads>",
            # "layerSdkName": "<name of the SDK layer>",
            # "securityGroupIds": "<List of Security Groups to use in every Lambda function's VPC Configuration>",
            # "subnetIds": "<List of Subnets to use in every Lambda function's VPC Configuration>"        
        }
        
        cfn_application =sam.CfnApplication(
            self, "SAR",
            location={
                "applicationId": "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning",
                "semanticVersion": "4.4.0"
            },
            parameters = stateMachineConfiguration
        )
