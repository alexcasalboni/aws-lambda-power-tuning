using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.SAM;
using Constructs;

namespace TheLambdaPowerTuner
{
    public class TheLambdaPowerTunerStack : Stack
    {
        internal TheLambdaPowerTunerStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
        {
            const string powerValues = "128,256,512,1024,1536,3008";
            const string lambdaResource = "*";

            new CfnApplication(this, "SAR", new CfnApplicationProps
                {
                    Location = new CfnApplication.ApplicationLocationProperty {
                        ApplicationId = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning",
                        // TODO change semantic version to latest
                        SemanticVersion = "4.2.0"
                    },
                    Parameters = new Dictionary<string, string> {
                        { "lambdaResource", lambdaResource},
                        { "PowerValues", powerValues }
                    }
                }
            );
        }
    }
}