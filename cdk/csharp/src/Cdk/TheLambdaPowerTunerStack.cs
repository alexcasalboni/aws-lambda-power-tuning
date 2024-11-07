using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.SAM;
using Constructs;

namespace TheLambdaPowerTunerStack
{
    public class TheLambdaPowerTunerStack : Stack
    {
        internal TheLambdaPowerTunerStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
        {
            var stateMachineConfiguration = new Dictionary<string, string>
            {
                // { "lambdaResource", "*" },
                // { "PowerValues", "128,256,512,1024,1536,3008" },
                // { "visualizationURL", "https://lambda-power-tuning.show/" },
                // { "totalExecutionTimeout", "300" },
                // { "payloadS3Key", "*" },
                // { "logGroupRetentionInDays", "7" },
                // { "stateMachineNamePrefix", "powerTuningStateMachine" },
                // { "permissionsBoundary", "<ARN of permission boundary>" },
                // { "payloadS3Bucket", "<S3 bucket name used for large payloads>" },
                // { "layerSdkName", "<name of the SDK layer>" },
                // { "securityGroupIds", "<List of Security Groups to use in every Lambda function's VPC Configuration>" },
                // { "subnetIds", "<List of Subnets to use in every Lambda function's VPC Configuration>" },
            };

            new CfnApplication(this, "SAR", new CfnApplicationProps
                {
                    Location = new CfnApplication.ApplicationLocationProperty {
                        ApplicationId = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning",
                        SemanticVersion = "4.3.6"
                    },
                    Parameters = stateMachineConfiguration
                }
            );
        }
    }
}