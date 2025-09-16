#!/bin/bash
# config
BUCKET_NAME=serverlessrepo-aws-lambda-power-tuning
STACK_NAME=serverlessrepo-aws-lambda-power-tuning

# package
sam package --s3-bucket $BUCKET_NAME --template-file scripts/deploy-sar-app.yml --output-template-file packaged-sar.yml

# deploy
sam deploy --template-file packaged-sar.yml --stack-name $STACK_NAME --capabilities CAPABILITY_AUTO_EXPAND CAPABILITY_IAM
