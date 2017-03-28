var program = require('commander');

// constants and default values
const DEFAULT_POWER_VALUES = "128,192,256,320,384,448,512,576,640,704,768,832,896,960,1024,1088,1152,1216,1280,1344,1408,1472,1536";
const PREFIX = "aws-lambda-power-tuning-dev-";  // package name and sls env
const INITIALIZER_FUNCTION = PREFIX + "initializer";
const EXECUTOR_FUNCTION = PREFIX + "executor";
const FINALIZER_FUNCTION = PREFIX + "finalizer";
const CLEANER_FUNCTION = PREFIX + "cleaner";

// program definition
program
    .version('0.0.1')
    .option('-R, --region <REGION>', 'The AWS Region name')
    .option('-A, --account <ACCOUNT_ID>', 'Your AWS Account ID')
    .action(function(REGION, ACCOUNT_ID) {
        const powerValues = DEFAULT_POWER_VALUES.split(',');  // TODO optional param?
        const stateMachine = buildStateMachine(REGION, ACCOUNT_ID, powerValues);
        console.log(stateMachine);
    })
    .parse(process.argv);


function buildStateMachine (region, account, powerValues) {

    var machineTemplate = stateMachineTemplate();

    powerValues.forEach(function(value) {

        machineTemplate.States.Branching.Branches.push(createBranch(value));

    });

    return JSON.stringify(machineTemplate)
        .replace(/\{REGION\}/g, region)
        .replace(/\{ACCOUNT_ID\}/g, account);

}


function createBranch (num) {
    const branch = branchTemplate();
    const branchStr = JSON.stringify(branch).replace(/\{num\}/g, num);
    return JSON.parse(branchStr);
}


function stateMachineTemplate () {
    return {
      "Comment": "Step Functions state machine generator for AWS Lambda Power Tuning",
      "StartAt": "Initializer",
      "States": {
        "Initializer": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:" + INITIALIZER_FUNCTION,
          "Next": "Branching"
        },
        "Branching": {
          "Type": "Parallel",
          "Next": "After Branching",
          "Branches": []  // will be filled w/ one branch for each power value
        },
        "After Branching": {
          "Type": "Parallel",
          "End": true,
          "Branches": [
            {
              "StartAt": "Finalizer",
              "States": {
                "Finalizer": {
                  "Type": "Task",
                  "Resource": "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:" + FINALIZER_FUNCTION,
                  "End": true
                }
              }
            },
            {
              "StartAt": "Cleaner",
              "States": {
                "Cleaner": {
                  "Type": "Task",
                  "Resource": "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:" + CLEANER_FUNCTION,
                  "End": true
                }
              }
            }
          ]
        }
      }
    };
}


function branchTemplate () {
    return {
      "StartAt": "{num}MB",
      "States": {
        "{num}MB": {
          "Type": "Pass",
          "Result": "128",
          "ResultPath": "$.num",
          "Next": "{num}MB Executor"
        },
        "{num}MB Executor": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:" + EXECUTOR_FUNCTION,
          "End": true
        }
      }
    };
}
