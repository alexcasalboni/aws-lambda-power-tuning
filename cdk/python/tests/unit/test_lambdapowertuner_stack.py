import aws_cdk as cdk
import aws_cdk.assertions as assertions

from app.lambdapowertuner_stack import TheLambdaPowerTunerStack

# example tests. To run these tests, uncomment this file along with the example
# resource in python/python_stack.py
def test_sar_app_created():
    app = cdk.App()
    stack = TheLambdaPowerTunerStack(app, "TheLambdaPowerTunerStack")
    template = assertions.Template.from_stack(stack)
    
    template.has_resource_properties("AWS::Serverless::Application", {
        "Location":{
            "ApplicationId": "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning"
        }   
})
