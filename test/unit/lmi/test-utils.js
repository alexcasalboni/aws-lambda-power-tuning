'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

const lmiUtils = require('../../../lambda/lmi/utils');

describe('LMI Utils', () => {
    let sandBox;

    beforeEach(() => {
        sandBox = sinon.createSandbox();
    });

    afterEach(() => {
        sandBox.restore();
    });

    describe('computeLmiPrice', () => {
        it('should compute per-invocation LMI cost correctly', () => {
            const instanceCostHourly = 0.1444; // c8g.xlarge
            const avgDurationMs = 100; // 100ms
            const effectiveConcurrency = 10;

            const price = lmiUtils.computeLmiPrice(instanceCostHourly, avgDurationMs, effectiveConcurrency);

            // (0.1444 * 1.15 / 3600) * (100 / 1000) / 10 + 0.0000002
            const expectedComputeCost = (instanceCostHourly * 1.15 / 3600) * (avgDurationMs / 1000) / effectiveConcurrency;
            const expectedTotal = expectedComputeCost + 0.0000002;
            expect(price).to.be(expectedTotal);
        });

        it('should include management fee and request cost', () => {
            const price = lmiUtils.computeLmiPrice(0.1444, 1000, 1);
            expect(price).to.be.greaterThan(0.0000002);
        });

        it('should decrease cost as concurrency increases', () => {
            const price1 = lmiUtils.computeLmiPrice(0.1444, 100, 1);
            const price10 = lmiUtils.computeLmiPrice(0.1444, 100, 10);
            expect(price10).to.be.lessThan(price1);
        });

        it('should scale linearly with duration', () => {
            const price100 = lmiUtils.computeLmiPrice(0.1444, 100, 1);
            const price200 = lmiUtils.computeLmiPrice(0.1444, 200, 1);
            const computeCost100 = price100 - 0.0000002;
            const computeCost200 = price200 - 0.0000002;
            expect(Math.abs(computeCost200 / computeCost100 - 2)).to.be.lessThan(0.001);
        });
    });

    describe('fetchInstancePricing', () => {
        it('should parse pricing from API response', async() => {
            sandBox.stub(lmiUtils, 'fetchInstancePricing').resolves(0.1444);

            const cost = await lmiUtils.fetchInstancePricing('c8g.xlarge', 'us-east-1');
            expect(cost).to.be(0.1444);
        });

        it('should throw when no pricing found', async() => {
            sandBox.stub(lmiUtils, 'fetchInstancePricing').rejects(new Error('No pricing found'));

            try {
                await lmiUtils.fetchInstancePricing('x99.mega', 'us-east-1');
                expect().fail('should have thrown');
            } catch (err) {
                expect(err.message).to.contain('No pricing found');
            }
        });
    });

    describe('LMI_DEFAULTS', () => {
        it('should have expected default values', () => {
            expect(lmiUtils.LMI_DEFAULTS.memoryPerVCpuValues).to.eql([2.0, 4.0, 6.0, 8.0]);
            expect(lmiUtils.LMI_DEFAULTS.concurrencyValues).to.eql([1, 2, 5, 10, 20, 50, 100]);
            expect(lmiUtils.LMI_DEFAULTS.testDurationSeconds).to.be(60);
            expect(lmiUtils.LMI_DEFAULTS.degradationThreshold).to.be(null);
            expect(lmiUtils.LMI_DEFAULTS.instanceTypes).to.eql(['c8g.xlarge']);
            expect(lmiUtils.LMI_DEFAULTS.architecture).to.be('arm64');
        });
    });

    describe('generateCapacityProviderName', () => {
        it('should generate a name from the Lambda ARN', () => {
            const name = lmiUtils.generateCapacityProviderName('arn:aws:lambda:us-east-1:123456789:function:myFunc');
            expect(name).to.contain('pt-myFunc');
            expect(name).to.match(/pt-myFunc-\d+/);
        });

        it('should include instance type in name when provided', () => {
            const name = lmiUtils.generateCapacityProviderName('arn:aws:lambda:us-east-1:123456789:function:myFunc', 'c8g.xlarge');
            expect(name).to.contain('pt-myFunc');
            expect(name).to.contain('c8gxlarge');
        });

        it('should truncate long function names', () => {
            const longName = 'a'.repeat(200);
            const arn = `arn:aws:lambda:us-east-1:123456789:function:${longName}`;
            const name = lmiUtils.generateCapacityProviderName(arn);
            expect(name.length).to.be.lessThan(141);
        });
    });

    describe('runSustainedLoad', () => {
        it('should invoke Lambda concurrently for the specified duration', async() => {
            const mockClient = { send: sinon.stub().resolves({ StatusCode: 200, Payload: 'null' }) };
            sandBox.stub(lmiUtils, 'lambdaClientFromARN').returns(mockClient);

            const result = await lmiUtils.runSustainedLoad(
                'arn:aws:lambda:us-east-1:123:function:test',
                'v1', '{}', 2, 0.1, true,
            );

            expect(result.durations).to.be.an('array');
            expect(result.durations.length).to.be.greaterThan(0);
            expect(result.totalInvocations).to.be.greaterThan(0);
            expect(result.errors).to.be(0);
        });

        it('should count errors separately from successful invocations', async() => {
            let callCount = 0;
            const mockClient = {
                send: sinon.stub().callsFake(async() => {
                    callCount++;
                    if (callCount % 2 === 0) {
                        return { StatusCode: 200, FunctionError: 'Unhandled', Payload: '{}' };
                    }
                    return { StatusCode: 200, Payload: 'null' };
                }),
            };
            sandBox.stub(lmiUtils, 'lambdaClientFromARN').returns(mockClient);

            const result = await lmiUtils.runSustainedLoad(
                'arn:aws:lambda:us-east-1:123:function:test',
                'v1', '{}', 1, 0.1, true,
            );

            expect(result.errors).to.be.greaterThan(0);
            expect(result.totalInvocations).to.be.greaterThan(result.durations.length);
        });

        it('should handle invocation exceptions gracefully', async() => {
            const mockClient = {
                send: sinon.stub().rejects(new Error('Connection timeout')),
            };
            sandBox.stub(lmiUtils, 'lambdaClientFromARN').returns(mockClient);
            sandBox.stub(lmiUtils, 'sleep').resolves();

            const result = await lmiUtils.runSustainedLoad(
                'arn:aws:lambda:us-east-1:123:function:test',
                'v1', '{}', 1, 0.1, true,
            );

            expect(result.durations.length).to.be(0);
            expect(result.errors).to.be.greaterThan(0);
        });
    });

    describe('updateFunctionLmiConfig', () => {
        it('should call UpdateFunctionConfiguration with capacity provider config', async() => {
            await lmiUtils.updateFunctionLmiConfig(
                'arn:aws:lambda:us-east-1:123:function:test',
                'arn:aws:lambda:us-east-1:123:capacity-provider:cp1',
                4.0,
                10,
            );
        });
    });
});
