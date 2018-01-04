const program = require('commander');
const fs = require('fs');
const yaml = require('js-yaml');

// function names
const PREFIX = 'aws-lambda-power-tuning-dev-';  // package name and sls env
const INITIALIZER_FUNCTION = PREFIX + 'initializer';
const EXECUTOR_FUNCTION = PREFIX + 'executor';
const FINALIZER_FUNCTION = PREFIX + 'finalizer';
const CLEANER_FUNCTION = PREFIX + 'cleaner';

// state machine templates
const MACHINE_TEMPLATE = fs.readFileSync('statemachine/template.json', 'utf8');
const BRANCH_TEMPLATE = fs.readFileSync('statemachine/template-branch.json', 'utf8');
const IAM_TEMPLATE = fs.readFileSync('statemachine/template-iam-role.json', 'utf8');


// YAML config (serverles.hml)
const SERVERLESS_YAML_FILENAME = './serverless.yml';
const SERVERLESS_BASE_YAML_FILENAME = './serverless.base.yml';
var serverlessYaml = yaml.safeLoad(fs.readFileSync(SERVERLESS_BASE_YAML_FILENAME, 'utf8'));
const DEFAULT_POWER_VALUES = '128,192,256,320,384,448,512,576,640,704,768,832,896,960,1024,1088,1152,1216,1280,1344,1408,1472,1536';
const DEFAULT_AWS_REGION = 'us-east-1';

// program definition
program
    .version('0.0.1')
    .option('-A, --account <id>', 'Your AWS Account ID')
    .option('-R, --region [name]', 'The AWS Region name', DEFAULT_AWS_REGION)
    .option('-P, --power-values [values]', 'Comma-separated power values', str2list, DEFAULT_POWER_VALUES.split(','))
    .parse(process.argv);

if (!program.account) {
    return console.error('Missing account id, use -A or --account\n');
}

(function runCommand(accountId, region, powerValues) {

    const stateMachineStr = buildStateMachine(accountId, region, powerValues);

    // update state machine definition
    var lambdaPowerStateMachine = serverlessYaml.resources.Resources.LambdaPowerStateMachine;
    lambdaPowerStateMachine.Properties.DefinitionString = stateMachineStr;

    // update power values (functions env variable)
    serverlessYaml.provider.environment.powerValues = powerValues.join(',');

    // update IAM assume role policy document (region required)
    var iamRole = serverlessYaml.resources.Resources.LambdaPowerStateMachineRole;
    iamRole.Properties.AssumeRolePolicyDocument = createIAMRolePolicyDocument({REGION: region});

    serverlessYaml.provider.region = region;

    // write back to yaml file
    const newYaml = yaml.safeDump(serverlessYaml, {lineWidth: 999999});
    fs.writeFileSync(SERVERLESS_YAML_FILENAME, newYaml);

    console.log('Target Region: ' + region);
    console.log('Done. Check your serverless.yml file :)\n');

})(program.account, program.region, program.powerValues);


function buildStateMachine (accountId, region, powerValues) {

    var machineTemplate = JSON.parse(MACHINE_TEMPLATE),
        branches = machineTemplate.States.Branching.Branches,
        vars = {'REGION': region, 'ACCOUNT_ID': accountId};

    powerValues.forEach(function(value) {
        vars.NUM = value;
        branches.push(createBranch(vars));
    });

    return applyTemplateVars(JSON.stringify(machineTemplate), vars);
}

function createBranch (vars) {
    const branch = applyTemplateVars(BRANCH_TEMPLATE, vars);
    return JSON.parse(branch);
}

function createIAMRolePolicyDocument (vars) {
    const doc = applyTemplateVars(IAM_TEMPLATE, vars);
    return JSON.parse(doc);
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

function str2list (str) {
    return str.split(',');
}
