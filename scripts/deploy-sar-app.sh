# config
BUCKET_NAME=sam-templates-demos-dublin
STACK_NAME=lambda-power-tuning-app-2

# package
sam package --s3-bucket $BUCKET_NAME --template-file scripts/deploy-sar-app.yml --output-template-file packaged-sar.yml

# deploy
sam deploy --template-file packaged-sar.yml --stack-name $STACK_NAME --capabilities CAPABILITY_AUTO_EXPAND CAPABILITY_IAM
