'use strict';


const expect = require('expect.js'),
    utils = require('./utils'),
    payloads = require('./payloads');


//also required: process.env.AWS_REGION;
const STACK_NAME = utils.buildStackName(process.env.STACK_NAME_DEFAULTS, process.env.BRANCH_NAME),
    payloadSample = payloads.get('sample'),
    payloadSample2 = payloads.get('sample2'),
    payloadInvalid = payloads.get('invalid');

var stateMachineArn, cfnStack;

const asyncTestsSetup = [
    {payload: payloadSample, name: 'sample', status: 'SUCCEEDED'},
    {payload: payloadSample2, name: 'sample2', status: 'SUCCEEDED'},
    {payload: payloadInvalid, name: 'invalid', status: 'FAILED'},
];

// this will start all the executions in parallel
// mocha doesn't allow this for tests in the same file
const fetchStackPromise = utils.fetchStackDetails(STACK_NAME);
fetchStackPromise.then((resp)=>{
    cfnStack = resp.stack;
    stateMachineArn = resp.stateMachine;
    asyncTestsSetup.forEach((test) => {
        test.promise = utils.startExecution(stateMachineArn, test.payload, test.name);
    });    
})


describe('Default Stack', () => {

    // make sure stack details are fetched only once
    // (while state machine executions have already started)
    beforeEach('fetch stack details', async() => {
        if (stateMachineArn) return;
        await fetchStackPromise;
    });

    it('should exist and be ready to use', async() => {
        expect(cfnStack).to.not.be(null);
        expect(cfnStack.StackStatus).to.be('CREATE_COMPLETE');
    });

    describe('State Machine', async() => {

        it('should have a valid ARN', async() => {
            expect(stateMachineArn.length).to.be.greaterThan(0);
        });

        // generate dynamically
        utils.generateTests(asyncTestsSetup)
    });

});
