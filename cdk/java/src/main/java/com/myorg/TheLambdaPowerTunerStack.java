package com.myorg;

import software.constructs.Construct;

import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.sam.CfnApplication;
import software.amazon.awscdk.services.sam.CfnApplication.ApplicationLocationProperty;
import java.util.HashMap;
import java.util.Map;

public class TheLambdaPowerTunerStack extends Stack {

    //Set constants
    private static final String SAR_APPLICATION_ID = "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning";
    private static final String SAR_SEMANTIC_VERSION = "4.4.0";

    public TheLambdaPowerTunerStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public TheLambdaPowerTunerStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        //create an empty Map
        Map<String,String> parameters = new HashMap<>();

        // parameters.put("lambdaResource", "*")
        // parameters.put("PowerValues", "128,256,512,1024,1536,3008")
        // parameters.put("visualizationURL", "https://lambda-power-tuning.shw/")
        // parameters.put("totalExecutionTimeout", "300")
        // parameters.put("payloadS3Key", "*")
        // parameters.put("logGroupRetentionInDays", "7")
        // parameters.put("stateMachineNamePrefix", "powerTuningStateMachine")
        // parameters.put("permissionsBoundary", "<ARN of permission boundary>")
        // parameters.put("payloadS3Bucket", "<S3 bucket name used for large payloads>")
        // parameters.put("layerSdkName", "<name of the SDK layer>")
        // parameters.put("securityGroupIds", "<List of Security Groups to use in every Lambda function's VPC Configuration>")
        // parameters.put("subnetIds", "<List of Subnets to use in every Lambda function's VPC Configuration>")
        // parameters.put("lambdaResource", "*")


        CfnApplication cfnApplication = CfnApplication.Builder.create(this, "SAR")
         .location(
            ApplicationLocationProperty.builder()
                .applicationId(SAR_APPLICATION_ID)
                .semanticVersion(SAR_SEMANTIC_VERSION)
                .build()
         )
         .parameters(parameters)
         .build();
    }
}
