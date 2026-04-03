'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

process.env.sfCosts = '{"default": 0.000025}';
process.env.baseCosts = '{"x86_64": {"default":2.1e-9}, "arm64": {"default":1.7e-9}}';
process.env.AWS_REGION = 'us-east-1';
process.env.visualizationURL = 'https://test.example.com/';

const utils = require('../../lambda/utils');
const handler = require('../../lambda/lmi-executor').handler;

const sandBox = sinon.createSandbox();
const fakeContext = {};

const makeEvent = function(overrides) {
    overrides = overrides || {};
    return {
        input: Object.assign({
            lambdaARN: 'arn:aws:lambda:us-east-1:123456789:function:myFunc',
            payload: {},
        }, overrides.input),
        lmiSetup: Object.assign({
            capacityProviderArn: 'arn:aws:lambda:us-east-1:123456789:capacity-provider:cp1',
            functionVersion: '5',
            instanceType: 'c8g.xlarge',
            instanceCostHourly: 0.1444,
            lmiConfig: Object.assign({
                instanceTypes: ['c8g.xlarge'],
                testDurationSeconds: 1, // short for tests
                degradationThreshold: 0.2,
                concurrencyValues: [1, 2, 5],
                memoryPerVCpuValues: [2.0, 4.0],
                disablePayloadLogs: true,
            }, overrides.lmiConfig),
        }, overrides.lmiSetup),
        value: Object.assign({
            memoryPerVCpu: 4.0,
            concurrencyValues: [1, 2, 5],
        }, overrides.value),
    };
};

describe('lmi-executor', () => {

    let updateLmiStub;

    beforeEach(() => {
        updateLmiStub = sandBox.stub(utils, 'updateFunctionLmiConfig').resolves({});
        sandBox.stub(utils, 'waitForFunctionUpdate').resolves({});
    });

    afterEach(() => {
        sandBox.restore();
    });

    describe('input validation', () => {
        it('should fail without lambdaARN', async() => {
            try {
                await handler(makeEvent({input: {lambdaARN: ''}}), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('lambdaARN');
            }
        });

        it('should fail without memoryPerVCpu', async() => {
            try {
                await handler(makeEvent({value: {memoryPerVCpu: null, concurrencyValues: [1]}}), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('memoryPerVCpu');
            }
        });

        it('should fail without concurrencyValues', async() => {
            try {
                await handler(makeEvent({value: {memoryPerVCpu: 4.0, concurrencyValues: []}}), fakeContext);
                expect().fail('should have thrown');
            } catch (e) {
                expect(e.message).to.contain('concurrencyValues');
            }
        });
    });

    describe('sustained load execution', () => {
        it('should test all concurrency values when no degradation', async() => {
            sandBox.stub(utils, 'runSustainedLoad')
                .callsFake(async() => ({
                    durations: Array(10).fill(5.0),
                    errors: 0,
                    totalInvocations: 10,
                }));

            const result = await handler(makeEvent(), fakeContext);

            expect(result.type).to.be('lmi');
            expect(result.memoryPerVCpu).to.be(4.0);
            expect(result.instanceType).to.be('c8g.xlarge');
            expect(result.allResults.length).to.be(3); // tested all 3 concurrency values
            expect(result.value).to.be(4.0);
            expect(result.averageDuration).to.be.a('number');
            expect(result.averagePrice).to.be.a('number');
        });

        it('should stop early when performance degrades', async() => {
            let callCount = 0;
            sandBox.stub(utils, 'runSustainedLoad')
                .callsFake(async() => {
                    callCount++;
                    const duration = callCount === 1 ? 5.0 : 50.0;
                    return {
                        durations: Array(10).fill(duration),
                        errors: 0,
                        totalInvocations: 10,
                    };
                });

            const result = await handler(makeEvent(), fakeContext);

            expect(result.allResults.length).to.be(2);
            expect(result.bestConcurrency).to.be(1);
        });

        it('should not stop early when degradationThreshold is null', async() => {
            let callCount = 0;
            sandBox.stub(utils, 'runSustainedLoad')
                .callsFake(async() => {
                    callCount++;
                    const duration = callCount === 1 ? 5.0 : 50.0;
                    return {
                        durations: Array(10).fill(duration),
                        errors: 0,
                        totalInvocations: 10,
                    };
                });

            const result = await handler(makeEvent({lmiConfig: {degradationThreshold: null}}), fakeContext);

            expect(result.allResults.length).to.be(3); // all concurrency values tested
        });

        it('should stop if no successful invocations', async() => {
            sandBox.stub(utils, 'runSustainedLoad')
                .resolves({durations: [], errors: 10, totalInvocations: 10});

            const result = await handler(makeEvent({value: {memoryPerVCpu: 4.0, concurrencyValues: [1, 2]}}), fakeContext);

            expect(result.allResults.length).to.be(0);
        });

        it('should track best duration across improvements', async() => {
            let callCount = 0;
            sandBox.stub(utils, 'runSustainedLoad')
                .callsFake(async() => {
                    callCount++;
                    const durations = [10.0, 5.0, 5.5];
                    const duration = durations[callCount - 1] || 5.0;
                    return {
                        durations: Array(10).fill(duration),
                        errors: 0,
                        totalInvocations: 10,
                    };
                });

            const result = await handler(makeEvent(), fakeContext);

            expect(result.allResults.length).to.be(3);
            expect(result.bestConcurrency).to.be(2);
        });

        it('should return correct LMI pricing', async() => {
            sandBox.stub(utils, 'runSustainedLoad')
                .resolves({
                    durations: Array(10).fill(100.0),
                    errors: 0,
                    totalInvocations: 10,
                });

            const result = await handler(makeEvent({value: {memoryPerVCpu: 4.0, concurrencyValues: [10]}}), fakeContext);

            const expectedPrice = utils.computeLmiPrice(0.1444, 100.0, 10);
            expect(result.averagePrice).to.be(expectedPrice);
        });

        it('should update function config for each concurrency value', async() => {
            sandBox.stub(utils, 'runSustainedLoad')
                .resolves({
                    durations: Array(5).fill(5.0),
                    errors: 0,
                    totalInvocations: 5,
                });

            await handler(makeEvent(), fakeContext);

            expect(updateLmiStub.callCount).to.be(3);
        });
    });
});
