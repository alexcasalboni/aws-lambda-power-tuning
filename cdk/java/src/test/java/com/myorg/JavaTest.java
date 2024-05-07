package com.myorg;

import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Template;
import java.io.IOException;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

public class JavaTest {

    @Test
    public void testStack() throws IOException {
        App app = new App();
        TheLambdaPowerTunerStack stack = new TheLambdaPowerTunerStack(app, "test");

        Template template = Template.fromStack(stack);
        Map<String, String> child = new HashMap<>();
        Map<String, Object> root = new HashMap<>();

        root.put("Location", child);
        child.put("ApplicationId", "arn:aws:serverlessrepo:us-east-1:451282441545:applications/aws-lambda-power-tuning");

        template.hasResourceProperties("AWS::Serverless::Application", root);
    }
}
