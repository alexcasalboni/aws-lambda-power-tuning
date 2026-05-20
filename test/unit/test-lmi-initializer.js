'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

// must set env vars before requiring utils
process.env.sfCosts = '{"default": 0.000025}';
process.env.baseCosts = '{"x86_64": {"default":2.1e-9}, "arm64": {"default":1.7e-9}}';
process.env.AWS_REGION = 'us-east-1';
process.env.visualizationURL = 'https://test.example.com/';

const utils = require('../../lambda/utils');
const handler = require('../../lambda/lmi-initializer').handler;

const sandBox = sinon.createSandbox();

const validEvent = {
    lambdaARN: 'arn:aws:lambda:us-east-1:123456789:function:myFunc',
    lmiConfig: {
        vpcConfig: {
            subnetIds: ['subnet-abc123'],
            securityGroupIds: ['sg-abc123'],
        },
        operatorRoleArn: 'arn:aws:iam::123456789:role/operator',
    },
};

const fakeContext = {};

const invokeForSuccess = async(event) => {
    const result = await handler(event, fakeContext);
    expect(result).to.not.be(null);
    return result;
};

const invokeForFailure = async(event) => {
    try {
        await handler(event, fakeContext);
        expect().fail('should have thrown');
    } catch (error) {
        expect(error).to.not.be(null);
        return error;
    }
};

describe('lmi-initializer', () => {

    beforeEach(() => {
        // Stub the Pricing API by default
        sandBox.stub(utils, 'fetchInstancePricing').callsFake(async(instanceType) => {
            const prices = {
                'c8g.xlarge': 0.1444,
                'c8g.2xlarge': 0.2888,
                'm7g.xlarge': 0.1632,
            };
            if (prices[instanceType]) return prices[instanceType];
            throw new Error(`No pricing found for ${instanceType}`);
        });
    });

    afterEach(() => {
        sandBox.restore();
    });

    describe('input validation', () => {
        const invalidEvents = [
            null,
            {},
            {lambdaARN: null},
            {lambdaARN: ''},
            {lambdaARN: 'arnOK'},
            {lambdaARN: 'arnOK', lmiConfig: {}},
            {lambdaARN: 'arnOK', lmiConfig: {vpcConfig: null}},
            {lambdaARN: 'arnOK', lmiConfig: {vpcConfig: {subnetIds: []}}},
            {lambdaARN: 'arnOK', lmiConfig: {vpcConfig: {subnetIds: ['s1'], securityGroupIds: []}}},
            {lambdaARN: 'arnOK', lmiConfig: {vpcConfig: {subnetIds: ['s1'], securityGroupIds: ['sg1']}}}, // missing operatorRoleArn
        ];

        invalidEvents.forEach(event => {
            it(`should fail with invalid input: ${JSON.stringify(event)}`, async() => {
                await invokeForFailure(event);
            });
        });
    });

    describe('successful initialization', () => {
        it('should return instanceTypeConfigs with default values', async() => {
            const result = await invokeForSuccess(validEvent);

            expect(result.instanceTypeConfigs).to.be.an('array');
            expect(result.instanceTypeConfigs.length).to.be(1); // 1 default instance type
            const config = result.instanceTypeConfigs[0];
            expect(config.instanceType).to.be('c8g.xlarge');
            expect(config.capacityProviderName).to.contain('pt-myFunc');
            expect(config.capacityProviderName).to.contain('c8gxlarge');
            expect(config.lmiTestMatrix).to.be.an('array');
            expect(config.lmiTestMatrix.length).to.be(4); // 4 default memoryPerVCpu values
            expect(config.lmiTestMatrix[0].memoryPerVCpu).to.be(2.0);
            expect(config.lmiTestMatrix[0].concurrencyValues).to.eql([1, 2, 5, 10, 20, 50, 100]);
            expect(config.instanceCostHourly).to.be(0.1444);
            expect(result.lambdaARN).to.be(validEvent.lambdaARN);
        });

        it('should fetch pricing from Pricing API', async() => {
            await invokeForSuccess(validEvent);
            expect(utils.fetchInstancePricing.calledOnce).to.be(true);
            expect(utils.fetchInstancePricing.firstCall.args[0]).to.be('c8g.xlarge');
            expect(utils.fetchInstancePricing.firstCall.args[1]).to.be('us-east-1');
        });

        it('should generate separate configs for multiple instance types (string format)', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    instanceTypes: ['c8g.xlarge', 'm7g.xlarge'],
                }),
            });
            const result = await invokeForSuccess(event);

            expect(result.instanceTypeConfigs.length).to.be(2);
            expect(result.instanceTypeConfigs[0].instanceType).to.be('c8g.xlarge');
            expect(result.instanceTypeConfigs[0].instanceCostHourly).to.be(0.1444);
            expect(result.instanceTypeConfigs[1].instanceType).to.be('m7g.xlarge');
            expect(result.instanceTypeConfigs[1].instanceCostHourly).to.be(0.1632);
            expect(result.instanceTypeConfigs[0].lmiTestMatrix).to.eql(result.instanceTypeConfigs[1].lmiTestMatrix);
        });

        it('should support object format for instanceTypes', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    instanceTypes: [
                        {instanceType: 'c8g.xlarge'},
                        {instanceType: 'm7g.xlarge', instanceCostHourly: 0.20},
                    ],
                }),
            });
            const result = await invokeForSuccess(event);

            expect(result.instanceTypeConfigs.length).to.be(2);
            // First: no user cost, should fetch from API
            expect(result.instanceTypeConfigs[0].instanceCostHourly).to.be(0.1444);
            // Second: user-provided cost, should NOT call API
            expect(result.instanceTypeConfigs[1].instanceCostHourly).to.be(0.20);
            // API should only be called once (for the first type)
            expect(utils.fetchInstancePricing.calledOnce).to.be(true);
        });

        it('should support mixed string and object format', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    instanceTypes: [
                        'c8g.xlarge',
                        {instanceType: 'm7g.xlarge', instanceCostHourly: 0.20},
                    ],
                }),
            });
            const result = await invokeForSuccess(event);

            expect(result.instanceTypeConfigs[0].instanceType).to.be('c8g.xlarge');
            expect(result.instanceTypeConfigs[1].instanceType).to.be('m7g.xlarge');
            expect(result.instanceTypeConfigs[1].instanceCostHourly).to.be(0.20);
        });

        it('should use custom memoryPerVCpuValues when provided', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    memoryPerVCpuValues: [3.0, 5.0],
                }),
            });
            const result = await invokeForSuccess(event);

            const matrix = result.instanceTypeConfigs[0].lmiTestMatrix;
            expect(matrix.length).to.be(2);
            expect(matrix[0].memoryPerVCpu).to.be(3.0);
            expect(matrix[1].memoryPerVCpu).to.be(5.0);
        });

        it('should use custom concurrencyValues when provided', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    concurrencyValues: [1, 5, 25],
                }),
            });
            const result = await invokeForSuccess(event);

            expect(result.instanceTypeConfigs[0].lmiTestMatrix[0].concurrencyValues).to.eql([1, 5, 25]);
        });

        it('should apply default instanceTypes', async() => {
            const result = await invokeForSuccess(validEvent);
            expect(result.lmiConfig.instanceTypes).to.eql(['c8g.xlarge']);
        });

        it('should apply default architecture', async() => {
            const result = await invokeForSuccess(validEvent);
            expect(result.lmiConfig.architecture).to.be('arm64');
        });

        it('should preserve custom degradationThreshold', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    degradationThreshold: 0.3,
                }),
            });
            const result = await invokeForSuccess(event);
            expect(result.lmiConfig.degradationThreshold).to.be(0.3);
        });

        it('should allow degradationThreshold of 0', async() => {
            const event = Object.assign({}, validEvent, {
                lmiConfig: Object.assign({}, validEvent.lmiConfig, {
                    degradationThreshold: 0,
                }),
            });
            const result = await invokeForSuccess(event);
            expect(result.lmiConfig.degradationThreshold).to.be(0);
        });

        it('should fail if Pricing API fails and no user cost provided', async() => {
            utils.fetchInstancePricing.restore();
            sandBox.stub(utils, 'fetchInstancePricing').rejects(new Error('No pricing found'));

            await invokeForFailure(validEvent);
        });
    });
});
