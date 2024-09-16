# note: this only works in the main AWS account where Lambda Power Tuning is deployed (SAR)

S3_BUCKET=alex-casalboni-apps

sam package --output-template-file packaged.yaml --s3-bucket $S3_BUCKET

sam publish --template packaged.yaml --region us-east-1