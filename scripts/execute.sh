#!/bin/bash
# config
STACK_NAME=lambda-power-tuning
INPUT=$(cat scripts/sample-execution-input.json)  # or use a static string

# retrieve state machine ARN
STATE_MACHINE_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`StateMachineARN`].OutputValue' --output text)

# start execution
EXECUTION_ARN=$(aws stepfunctions start-execution --state-machine-arn $STATE_MACHINE_ARN --input "$INPUT"  --query 'executionArn' --output text)

echo -n "Execution started..."

# poll execution status until completed
while true;
do
    # retrieve execution status
    STATUS=$(aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN --query 'status' --output text)

    if test "$STATUS" == "RUNNING"; then
        # keep looping and wait if still running
        echo -n "."
        sleep 1
    elif test "$STATUS" == "FAILED"; then
        # exit if failed
        echo -e "\nThe execution failed, you can check the execution logs with the following script:\naws stepfunctions get-execution-history --execution-arn $EXECUTION_ARN"
        break
    else
        # print execution output if succeeded
        echo $STATUS
        echo "Execution output: "
        # retrieve output
        aws stepfunctions describe-execution --execution-arn $EXECUTION_ARN --query 'output' --output text
        break
    fi
done
