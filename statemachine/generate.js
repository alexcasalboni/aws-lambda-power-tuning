const program = require('commander');
const fs = require('fs');
const yaml = require('js-yaml');

// function names
const PREFIX = "aws-lambda-power-tuning-dev-";  // package name and sls env
const INITIALIZER_FUNCTION = PREFIX + "initializer";
const EXECUTOR_FUNCTION = PREFIX + "executor";
const FINALIZER_FUNCTION = PREFIX + "finalizer";
const CLEANER_FUNCTION = PREFIX + "cleaner";

// state machine templates
const MACHINE_TEMPLATE = fs.readFileSync("statemachine/template.json", 'utf8');
const BRANCH_TEMPLATE = fs.readFileSync("statemachine/template-branch.json", 'utf8');


// YAML config (serverles.hml)
const SERVERLESS_YAML_FILENAME = './serverless.yml';
var serverlessYaml = yaml.safeLoad(fs.readFileSync(SERVERLESS_YAML_FILENAME, 'utf8'));
const DEFAULT_POWER_VALUES = serverlessYaml.provider.environment.powerValues;


// program definition
program
    .version('0.0.1')
    .option('-R, --region <REGION>', 'The AWS Region name')
    .option('-A, --account <ACCOUNT_ID>', 'Your AWS Account ID')
    .action(function(REGION, ACCOUNT_ID) {

        const stateMachineStr = buildStateMachine(REGION, ACCOUNT_ID);

        // edit state machine definition
        var lambdaPowerStateMachine = serverlessYaml.resources.Resources.LambdaPowerStateMachine;
        lambdaPowerStateMachine.Properties.DefinitionString = stateMachineStr;
        
        // write back to yaml file
        const newYaml = yaml.safeDump(serverlessYaml, {lineWidth: 999999});
        fs.writeFileSync(SERVERLESS_YAML_FILENAME, newYaml)

    })
    .parse(process.argv);


function buildStateMachine (REGION, ACCOUNT_ID, powerValues) {

    // TODO add optional param?
    powerValues = powerValues || DEFAULT_POWER_VALUES.split(',')

    var machineTemplate = JSON.parse(MACHINE_TEMPLATE),
        branches = machineTemplate.States.Branching.Branches,
        vars = {'REGION': REGION, 'ACCOUNT_ID': ACCOUNT_ID};

    powerValues.forEach(function(value) {
        branches.push(createBranch(value, vars));
    });

    return applyTemplateVars(JSON.stringify(machineTemplate), vars);
}

function createBranch (num, vars) {
    vars.NUM = num;
    const branch = applyTemplateVars(BRANCH_TEMPLATE, vars);
    return JSON.parse(branch);
}

function applyTemplateVars (template, vars) {
    return template
        .replace(/\{REGION\}/g, vars.REGION)
        .replace(/\{ACCOUNT_ID\}/g, vars.ACCOUNT_ID)
        .replace(/\{NUM\}/g, vars.NUM)
        .replace(/\{INITIALIZER_FUNCTION\}/g, INITIALIZER_FUNCTION)
        .replace(/\{EXECUTOR_FUNCTION\}/g, EXECUTOR_FUNCTION)
        .replace(/\{CLEANER_FUNCTION\}/g, CLEANER_FUNCTION)
        .replace(/\{FINALIZER_FUNCTION\}/g, FINALIZER_FUNCTION)
    ;
}
