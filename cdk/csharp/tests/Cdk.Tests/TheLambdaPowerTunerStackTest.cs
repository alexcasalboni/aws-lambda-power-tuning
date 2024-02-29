using Amazon.CDK;
using Amazon.CDK.Assertions;

using ObjectDict = System.Collections.Generic.Dictionary<string, object>;

namespace TheLambdaPowerTunerStack.Tests
{
    [TestClass]
    public class TheLambdaPowerTunerStackTest
    {
        private Template? _template;

        [TestInitialize()]
        public void Startup()
        {
            var app = new App();
            var stack = new TheLambdaPowerTunerStack(app, "TheLambdaPowerTunerStack", new StackProps());
            _template = Template.FromStack(stack);
        }

        [TestMethod]
        public void TestSar()
        {
            _template?.HasResourceProperties("AWS::Serverless::Application", new ObjectDict
                {
                    { "Location" , new ObjectDict
                        {
                            { "ApplicationId", "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning" },
                            { "SemanticVersion", "4.3.4" }
                        }
                    }
                } 
            );
        }
    }
}