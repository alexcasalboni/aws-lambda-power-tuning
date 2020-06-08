# config
BUCKET_NAME=sam-templates-demos-cpt
STACK_NAME=lambda-power-tuning-new
PowerValues='128,256,512,1024,1536,3008'
LambdaResource='*'

# package
sam package --s3-bucket $BUCKET_NAME --template-file template.yml --output-template-file packaged.yml

# deploy
sam deploy --template-file packaged.yml --stack-name $STACK_NAME --capabilities CAPABILITY_IAM --parameter-overrides PowerValues=$PowerValues lambdaResource=$LambdaResource
