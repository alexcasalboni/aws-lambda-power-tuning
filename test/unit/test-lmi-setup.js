'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

process.env.sfCosts = '{"default": 0.000025}';
process.env.baseCosts = '{"x86_64": {"default":2.1e-9}, "arm64": {"default":1.7e-9}}';
process.env.AWS_REGION = 'us-east-1';
process.env.visualizationURL = 'https://test.example.com/';

const utils = require('../../lambda/utils');
const handler = require('../../lambda/lmi-setup').handler;

const sandBox = sinon.createSandbox();
const fakeContext = {};

const fakeLmiFunctionArn = 'arn:aws:lambda:us-east-1:123456789:function:pt-myFunc-12345-fn';

const validEvent = {
    lambdaARN: 'arn:aws:lambda:us-east-1:123456789:function:myFunc',
    instanceTypeConfig: {
        instanceType: 'c8g.xlarge',
        capacityProviderName: 'pt-myFunc-c8gxlarge-12345',
        lmiTestMatrix: [{memoryPerVCpu: 2.0, concurrencyValues: [1, 2, 5]}],
        instanceCostHourly: 0.1444,
    },
    lmiConfig: {
        vpcConfig: {subnetIds: ['subnet-1'], securityGroupIds: ['sg-1']},
        operatorRoleArn: 'arn:aws:iam::123456789:role/operator',
        instanceTypes: ['c8g.xlarge'],
        architecture: 'arm64',
        memoryPerVCpuValues: [2.0, 4.0],
        concurrencyValues: [1, 2, 5],
        testDurationSeconds: 60,
        degradationThreshold: 0.2,
    },
};

describe('lmi-setup', () => {

    let createCpStub, waitCpStub, createLmiFnStub, publishStub;

    beforeEach(() => {
        createCpStub = sandBox.stub(utils, 'createCapacityProvider').resolves({});
        waitCpStub = sandBox.stub(utils, 'waitForCapacityProviderActive').resolves({
            Arn: 'arn:aws:lambda:us-east-1:123456789:capacity-provider:pt-myFunc-12345',
            State: 'Active',
        });
        createLmiFnStub = sandBox.stub(utils, 'createLmiFunction').resolves(fakeLmiFunctionArn);
        sandBox.stub(utils, 'waitForFunctionUpdate').resolves({});
        publishStub = sandBox.stub(utils, 'publishLambdaVersion').resolves({Version: '5'});
    });

    afterEach(() => {
        sandBox.restore();
    });

    describe('input validation', () => {
        it('should fail without lambdaARN', async() => {
            try {
                await handler(Object.assign({}, validEvent, {lambdaARN: ''}), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('lambdaARN');
            }
        });

        it('should fail without lmiConfig', async() => {
            try {
                await handler(Object.assign({}, validEvent, {lmiConfig: null}), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('lmiConfig');
            }
        });

        it('should fail without instanceTypeConfig', async() => {
            try {
                await handler(Object.assign({}, validEvent, {instanceTypeConfig: null}), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('instanceTypeConfig');
            }
        });

        it('should fail without instanceTypeConfig.instanceType', async() => {
            try {
                await handler(Object.assign({}, validEvent, {
                    instanceTypeConfig: Object.assign({}, validEvent.instanceTypeConfig, {instanceType: ''}),
                }), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('instanceTypeConfig.instanceType');
            }
        });

        it('should fail without instanceTypeConfig.capacityProviderName', async() => {
            try {
                await handler(Object.assign({}, validEvent, {
                    instanceTypeConfig: Object.assign({}, validEvent.instanceTypeConfig, {capacityProviderName: ''}),
                }), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('instanceTypeConfig.capacityProviderName');
            }
        });
    });

    describe('successful setup', () => {
        it('should create capacity provider and LMI function', async() => {
            await handler(validEvent, fakeContext);

            expect(createCpStub.calledOnce).to.be(true);
            expect(waitCpStub.calledOnce).to.be(true);
            expect(createLmiFnStub.calledOnce).to.be(true);
            expect(publishStub.calledOnce).to.be(true);
        });

        it('should return setup results including lmiFunctionArn', async() => {
            const result = await handler(validEvent, fakeContext);

            expect(result.capacityProviderName).to.be('pt-myFunc-c8gxlarge-12345');
            expect(result.lmiFunctionArn).to.be(fakeLmiFunctionArn);
            expect(result.functionVersion).to.be('5');
            expect(result.instanceType).to.be('c8g.xlarge');
            expect(result.instanceCostHourly).to.be(0.1444);
            expect(result.lambdaARN).to.be(validEvent.lambdaARN);
        });

        it('should pass correct instance type and architecture', async() => {
            await handler(validEvent, fakeContext);

            const cpArgs = createCpStub.firstCall.args;
            expect(cpArgs[0]).to.be('pt-myFunc-c8gxlarge-12345'); // name
            expect(cpArgs[1]).to.be('us-east-1'); // region
            expect(cpArgs[3].architectures).to.eql(['arm64']);
            expect(cpArgs[3].allowedInstanceTypes).to.eql(['c8g.xlarge']);
        });

        it('should create LMI function with correct parameters', async() => {
            await handler(validEvent, fakeContext);

            const fnArgs = createLmiFnStub.firstCall.args;
            expect(fnArgs[0]).to.be(validEvent.lambdaARN); // source ARN
            expect(fnArgs[1]).to.be('pt-myFunc-c8gxlarge-12345-fn'); // new function name
            expect(fnArgs[2]).to.contain('capacity-provider'); // CP ARN
            expect(fnArgs[3]).to.be(2.0); // initial memoryPerVCpu
            expect(fnArgs[4]).to.be(1); // initial concurrency
        });
    });
});
