bucket = "sg-ssd-{stage}-{workload}-local-tfstate"
region = "eu-west-2"
key = "environments-{workload}/{environment}/{component}.tfstate"
dynamodb_table = "sg-ssd-{stage}-{workload}-local-tfstatelock"
