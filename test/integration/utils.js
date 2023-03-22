'use strict';

const AWS = require('aws-sdk'),
    expect = require('expect.js'),
    crypto = require("crypto"),
    utils = module.exports,
    cfn = new AWS.CloudFormation(),
    stepFunctions = new AWS.StepFunctions();


module.exports.buildStackName = (prefix, branchRef) =>  {
    return `${prefix}-${branchRef.replace('/', '-')}`;
};

module.exports.generateTests = (tests) =>  {
    tests.forEach((test) => {
        it(`should run payload ${test.name} with status ${test.status}`, async() => {
            const resp = await test.promise;
            expect(resp.executionArn.length).to.be.greaterThan(0);
            const status = await utils.waitForCompletedExecution(resp.executionArn);
            expect(status).to.be(test.status);
        });
    }); 
};


module.exports.fetchStackDetails = async(stackName) => {
    console.log('fetching stack details');
    const resp = await cfn.describeStacks({StackName: stackName}).promise();
    const stack = resp.Stacks[0];
    const stateMachine = stack.Outputs[0].OutputValue
    return {stack, stateMachine};
};

module.exports.startExecution = async(stateMachineArn, input, namePrefix) => {
    input = JSON.stringify(input);
    const name = namePrefix + `-` + crypto.randomBytes(10).toString('hex');
    return await stepFunctions.startExecution({
        stateMachineArn,
        input,
        name,
    }).promise();
};

module.exports.waitForCompletedExecution = async(executionArn) => {
    var exec;
    do {
        console.log('waiting 1s');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('fetching execution status');
        exec = await stepFunctions.describeExecution({ executionArn }).promise();
    } while (exec.status === 'RUNNING')
    console.log('completed with status', exec.status);
    // return final status
    return exec.status;
};
