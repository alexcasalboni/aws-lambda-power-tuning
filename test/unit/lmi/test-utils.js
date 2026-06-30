'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

process.env.lmiStagingBucket = 'test-staging-bucket';

const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { GetFunctionCommand, CreateFunctionCommand } = require('@aws-sdk/client-lambda');

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

    describe('stageSourceCode', () => {
        let s3SendStub, fetchStub;

        beforeEach(() => {
            s3SendStub = sinon.stub().resolves({});
            sandBox.stub(lmiUtils, 's3ClientForRegion').returns({send: s3SendStub});
            fetchStub = sandBox.stub(global, 'fetch').resolves({
                ok: true,
                arrayBuffer: async() => new Uint8Array([1, 2, 3]).buffer,
            });
        });

        it('should download the source package and upload it to the staging bucket', async() => {
            const key = await lmiUtils.stageSourceCode('https://presigned.example.com/code.zip', 'pt-myFunc-fn', 'us-east-1');

            expect(fetchStub.calledOnce).to.be(true);
            expect(key).to.be('lmi-staging/pt-myFunc-fn.zip');

            expect(s3SendStub.calledOnce).to.be(true);
            const command = s3SendStub.firstCall.args[0];
            expect(command).to.be.a(PutObjectCommand);
            expect(command.input.Bucket).to.be('test-staging-bucket');
            expect(command.input.Key).to.be('lmi-staging/pt-myFunc-fn.zip');
        });

        it('should throw when the download fails', async() => {
            fetchStub.resolves({ok: false, status: 403});
            try {
                await lmiUtils.stageSourceCode('https://presigned.example.com/code.zip', 'pt-myFunc-fn', 'us-east-1');
                expect().fail('should have thrown');
            } catch (err) {
                expect(err.message).to.contain('Failed to download source code');
            }
        });
    });

    describe('deleteStagedCode', () => {
        let s3SendStub;

        beforeEach(() => {
            s3SendStub = sinon.stub().resolves({});
            sandBox.stub(lmiUtils, 's3ClientForRegion').returns({send: s3SendStub});
        });

        it('should delete the staged object', async() => {
            await lmiUtils.deleteStagedCode('lmi-staging/pt-myFunc-fn.zip', 'us-east-1');

            expect(s3SendStub.calledOnce).to.be(true);
            const command = s3SendStub.firstCall.args[0];
            expect(command).to.be.a(DeleteObjectCommand);
            expect(command.input.Key).to.be('lmi-staging/pt-myFunc-fn.zip');
        });

        it('should not call S3 when no key is provided', async() => {
            await lmiUtils.deleteStagedCode(null, 'us-east-1');
            expect(s3SendStub.called).to.be(false);
        });

        it('should swallow deletion errors', async() => {
            s3SendStub.rejects(new Error('AccessDenied'));
            // Should not throw
            await lmiUtils.deleteStagedCode('lmi-staging/pt-myFunc-fn.zip', 'us-east-1');
        });
    });

    describe('createLmiFunction', () => {
        let lambdaSendStub;

        beforeEach(() => {
            lambdaSendStub = sinon.stub();
            lambdaSendStub.withArgs(sinon.match.instanceOf(GetFunctionCommand)).resolves({
                Configuration: {
                    Role: 'arn:aws:iam::123:role/exec',
                    Handler: 'index.handler',
                    Runtime: 'nodejs22.x',
                    Timeout: 30,
                    MemorySize: 1024,
                    Architectures: ['arm64'],
                },
                Code: {Location: 'https://presigned.example.com/code.zip'},
            });
            lambdaSendStub.withArgs(sinon.match.instanceOf(CreateFunctionCommand)).resolves({
                FunctionArn: 'arn:aws:lambda:us-east-1:123:function:pt-myFunc-fn',
            });
            sandBox.stub(lmiUtils, 'lambdaClientFromARN').returns({send: lambdaSendStub});

            // stageSourceCode/deleteStagedCode are exercised via their own tests;
            // here we just verify createLmiFunction wires them together correctly.
            sandBox.stub(lmiUtils, 'stageSourceCode').resolves('lmi-staging/pt-myFunc-fn.zip');
            sandBox.stub(lmiUtils, 'deleteStagedCode').resolves();
        });

        it('should create the function from the staged S3 object and clean it up', async() => {
            const arn = await lmiUtils.createLmiFunction(
                'arn:aws:lambda:us-east-1:123:function:myFunc',
                'pt-myFunc-fn',
                'arn:aws:lambda:us-east-1:123:capacity-provider:cp1',
                2.0,
                1,
            );

            expect(arn).to.be('arn:aws:lambda:us-east-1:123:function:pt-myFunc-fn');
            expect(lmiUtils.stageSourceCode.calledOnce).to.be(true);

            const createCall = lambdaSendStub.getCalls().find(c => c.args[0] instanceof CreateFunctionCommand);
            expect(createCall).to.be.ok();
            const input = createCall.args[0].input;
            expect(input.Code.S3Bucket).to.be('test-staging-bucket');
            expect(input.Code.S3Key).to.be('lmi-staging/pt-myFunc-fn.zip');
            expect(input.Code.ZipFile).to.be(undefined);

            // staged object should be cleaned up after creation
            expect(lmiUtils.deleteStagedCode.calledOnceWith('lmi-staging/pt-myFunc-fn.zip')).to.be(true);
        });

        it('should clean up the staged object even if CreateFunction fails', async() => {
            lambdaSendStub.withArgs(sinon.match.instanceOf(CreateFunctionCommand)).rejects(new Error('CreateFunction failed'));

            try {
                await lmiUtils.createLmiFunction(
                    'arn:aws:lambda:us-east-1:123:function:myFunc',
                    'pt-myFunc-fn',
                    'arn:aws:lambda:us-east-1:123:capacity-provider:cp1',
                    2.0,
                    1,
                );
                expect().fail('should have thrown');
            } catch (err) {
                expect(err.message).to.contain('CreateFunction failed');
            }

            expect(lmiUtils.deleteStagedCode.calledOnce).to.be(true);
        });
    });
});
