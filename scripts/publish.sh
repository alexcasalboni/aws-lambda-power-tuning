# note: this only works in the main AWS account where Lambda Power Tuning is deployed (SAR)

S3_BUCKET=alex-casalboni-apps

sam package --template-file template.yml --output-template-file packaged.yml --s3-bucket $S3_BUCKET --region us-east-1

sam publish --template packaged.yml --region us-east-1