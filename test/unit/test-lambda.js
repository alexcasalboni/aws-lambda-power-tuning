'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

var awsV3Mock = require('aws-sdk-client-mock');
const {
    CreateAliasCommand, DeleteAliasCommand, DeleteFunctionCommand, GetAliasCommand,
    InvokeCommand, LambdaClient, PublishVersionCommand, UpdateAliasCommand,
    UpdateFunctionConfigurationCommand, ResourceNotFoundException,
} = require('@aws-sdk/client-lambda');

const utils = require('../../lambda/utils');

// mock all the Lambda API's
const lambdaMock = awsV3Mock.mockClient(LambdaClient);
lambdaMock.reset();
lambdaMock.on(GetAliasCommand).resolves({});
lambdaMock.on(UpdateFunctionConfigurationCommand).resolves({});
lambdaMock.on(PublishVersionCommand).resolves({});
lambdaMock.on(DeleteFunctionCommand).resolves({});
lambdaMock.on(CreateAliasCommand).resolves({});
lambdaMock.on(UpdateAliasCommand).resolves({});
lambdaMock.on(DeleteAliasCommand).resolves({});
lambdaMock.on(InvokeCommand).resolves({});

// mock environment variables and context
const powerValues = [128, 256, 512, 1024];
process.env.defaultPowerValues = powerValues.join(',');
process.env.minRAM = 128;
process.env.baseCosts = '{"x86_64": {"ap-east-1":2.9e-9,"af-south-1":2.8e-9,"me-south-1":2.6e-9,"eu-south-1":2.4e-9,"default":2.1e-9}, "arm64": {"default":1.7e-9}}';
const fakeContext = {};

// variables used during tests
var setLambdaPowerCounter,
    publishLambdaVersionCounter,
    createLambdaAliasCounter,
    updateLambdaAliasCounter,
    waitForFunctionUpdateCounter,
    waitForAliasActiveCounter,
    sleepCounter;

// utility to invoke handler (success case)
const invokeForSuccess = async(handler, event) => {
    try {
        const result = await handler(event, fakeContext);
        expect(result).to.not.be(null);
        return result;
    } catch (error) {
        console.log(error);
        throw error;
    }
};

// utility to invoke handler and assert an exception is caught (success case)
const invokeForFailure = async(handler, event) => {

    let result;

    try {
        result = await handler(event, fakeContext);
    } catch (error) {
        expect(error).to.not.be(null);
        return error;
    }

    expect(result).to.be(null);

};

// utility to create a UInt8Array from a string
const toByteArray = (inputString) => {
    const textEncoder = new TextEncoder();
    return textEncoder.encode(inputString);
};

// Stub stuff
const sandBox = sinon.createSandbox();
var getLambdaAliasStub,
    setLambdaPowerStub,
    publishLambdaVersionStub,
    createLambdaAliasStub,
    updateLambdaAliasStub,
    deleteLambdaVersionStub,
    invokeLambdaStub,
    invokeLambdaProcessorStub,
    deleteLambdaAliasStub,
    getLambdaConfigStub,
    fetchPayloadFromS3Stub;

/** unit tests below **/

const singleAliasConfig = { aliases: ['RAM128']};
describe('Lambda Functions', async() => {

    beforeEach('mock utilities', () => {
        setLambdaPowerCounter = 0;
        publishLambdaVersionCounter = 0;
        createLambdaAliasCounter = 0;
        updateLambdaAliasCounter = 0;
        waitForFunctionUpdateCounter = 0;
        waitForAliasActiveCounter = 0;
        sleepCounter = 0;

        sandBox.stub(utils, 'regionFromARN')
            .callsFake((arn) => {
                return arn;
            });
        sandBox.stub(utils, 'baseCostForRegion')
            .callsFake((_priceMap, region) => {
                return region === 'af-south-1' ? 2.8e-9 : 2.1e-9;
            });
        getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
            .callsFake(async() => {
                const error = new ResourceNotFoundException('alias is not defined');
                throw error;
            });
        setLambdaPowerStub = sandBox.stub(utils, 'setLambdaPower')
            .callsFake(async() => {
                setLambdaPowerCounter++;
                return 'OK';
            });
        publishLambdaVersionStub = sandBox.stub(utils, 'publishLambdaVersion')
            .callsFake(async() => {
                publishLambdaVersionCounter++;
                return { Version: 1 };
            });
        createLambdaAliasStub = sandBox.stub(utils, 'createLambdaAlias')
            .callsFake(async() => {
                createLambdaAliasCounter++;
                return 'OK';
            });
        updateLambdaAliasStub = sandBox.stub(utils, 'updateLambdaAlias')
            .callsFake(async() => {
                updateLambdaAliasCounter++;
                return 'OK';
            });
        sandBox.stub(utils, 'waitForFunctionUpdate')
            .callsFake(async() => {
                waitForFunctionUpdateCounter++;
                return 'OK';
            });
        sandBox.stub(utils, 'waitForAliasActive')
            .callsFake(async() => {
                waitForAliasActiveCounter++;
                return 'OK';
            });
        sandBox.stub(utils, 'sleep')
            .callsFake(async(_) => {
                sleepCounter++;
                return 'OK, no need to wait =)';
            });
    });

    afterEach('Global mock utilities afterEach', () => {
        // restore everything to its natural order
        sandBox.restore();
    });

    describe('initializer', async() => {

        const handler = require('../../lambda/initializer').handler;

        let invalidEvents = [
            null,
            {},
            { lambdaARN: null },
            { lambdaARN: '' },
            { lambdaARN: false },
            { lambdaARN: 0 },
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked without a lambdaARN - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        invalidEvents = [
            { num: -1, lambdaARN: 'arnOK' },
            { num: 0, lambdaARN: 'arnOK' },
            { num: 1, lambdaARN: 'arnOK' },
            { num: 2, lambdaARN: 'arnOK' },
            { num: 3, lambdaARN: 'arnOK' },
            { num: 4, lambdaARN: 'arnOK' },
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked with a low num - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        it('should invoke the given cb without powerValues as input', async() => {
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
        });

        it('should invoke the given cb with empty powerValues as input', async() => {
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5, powerValues: [] });
        });

        it('should invoke the given cb with powerValues as input', async() => {
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5, powerValues: [128, 256, 512] });
        });

        it('should invoke the given cb with powerValues=ALL as input', async() => {
            const generatedValues = await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5, powerValues: 'ALL' });
            expect(generatedValues.initConfigurations.length).to.be(47); // 46 power values plus the previous Lambda power configuration
        });

        it('should generate N configurations', async() => {
            const generatedValues = await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });

            // +1 because it will also reset power to its initial value
            expect(generatedValues.initConfigurations.length).to.be(powerValues.length + 1);
        });
        it('should generate N configurations', async() => {
            const generatedValues = await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });

            // +1 because it will also reset power to its initial value
            expect(generatedValues.initConfigurations.length).to.be(powerValues.length + 1);
        });
        it('should generate an alias for each `num` and `powerValue` when `onlyColdStarts` is set', async() => {

            const generatedValues = await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5, onlyColdStarts: true});

            // +1 because it will also reset power to its initial value
            expect(generatedValues.initConfigurations.length).to.be((powerValues.length * 5) + 1);
        });

    });

    describe('publisher', async() => {

        const handler = require('../../lambda/publisher').handler;

        const invalidEvents = [
            { },
            {lambdaARN: 'arnOK'},
            {lambdaARN: 'arnOK', lambdaConfigurations: {}},
            {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 512,
                        alias: 'RAM512',
                    }],
                },
            },
            {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    iterator: {
                        index: 1,
                        count: 1,
                    },
                },
            },
            {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 512,
                        alias: 'RAM512',
                    }, {
                        powerValue: 1024,
                        alias: 'RAM1024',
                    }],
                    iterator: {
                        index: 2,
                        count: 3,
                    },
                },
            },
            {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 512,
                        alias: 'RAM512',
                    }, {
                        powerValue: 1024,
                        alias: 'RAM1024',
                    }],
                    iterator: {
                        index: 3,
                        count: 2,
                    },
                },
            },
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked with invalid payload - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        it('should publish the given lambda version (first iteration)', async() => {
            const generatedValues = await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 512,
                        alias: 'RAM512',
                    }, {
                        powerValue: 1024,
                        alias: 'RAM1024',
                    }],
                    iterator: {
                        index: 0,
                        count: 2,
                    },
                }});
            expect(setLambdaPowerCounter).to.be(1);
            expect(waitForFunctionUpdateCounter).to.be(1);
            expect(publishLambdaVersionCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(1);
            expect(generatedValues.iterator.index).to.be(1); // index should be incremented by 1
            expect(generatedValues.iterator.continue).to.be(true); // the iterator should be set to continue=false
            expect(generatedValues.initConfigurations).to.be.a('array'); // initConfigurations should be a list
        });

        it('should publish the given lambda version (last iteration)', async() => {
            const generatedValues = await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 512,
                        alias: 'RAM512',
                    }, {
                        powerValue: 1024,
                        alias: 'RAM1024',
                    }],
                    iterator: {
                        index: 1,
                        count: 2,
                    },
                }});
            expect(setLambdaPowerCounter).to.be(1);
            expect(waitForFunctionUpdateCounter).to.be(1);
            expect(publishLambdaVersionCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(1);
            expect(generatedValues.iterator.index).to.be(2); // index should be incremented by 1
            expect(generatedValues.iterator.continue).to.be(false); // the iterator should be set to continue=false
            expect(generatedValues.initConfigurations).to.be(undefined); // initConfigurations should be unset
        });

        it('should publish the version even if an alias is not specified', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 512,
                    }],
                    iterator: {
                        index: 0,
                        count: 1,
                    },
                }});
        });

        it('should update an alias if it already exists', async() => {
            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async(lambdaARN, alias) => {
                    if (alias === 'RAM128') {
                        return { FunctionVersion: '1' };
                    } else {
                        const error = new ResourceNotFoundException('alias is not defined');
                        throw error;
                    }
                });
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 128,
                        alias: 'RAM128',
                    }],
                    iterator: {
                        index: 0,
                        count: 1,
                    },
                }});
            expect(updateLambdaAliasCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(0);
            expect(waitForFunctionUpdateCounter).to.be(1);
        });

        it('should explode if something goes wrong during power set', async() => {
            setLambdaPowerStub && setLambdaPowerStub.restore();
            setLambdaPowerStub = sandBox.stub(utils, 'setLambdaPower')
                .callsFake(async() => {
                    throw new Error('Something went wrong');
                });
            await invokeForFailure(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 128,
                        alias: 'RAM128',
                    }],
                    iterator: {
                        index: 0,
                        count: 1,
                    },
                }});
            expect(waitForFunctionUpdateCounter).to.be(0);
        });

        it('should NOT explode if something goes wrong during alias creation but it already exists', async() => {
            createLambdaAliasStub && createLambdaAliasStub.restore();
            createLambdaAliasStub = sandBox.stub(utils, 'createLambdaAlias')
                .callsFake(async() => {
                    throw new Error('Alias already exists');
                });
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 128,
                        alias: 'RAM128',
                    }],
                    iterator: {
                        index: 0,
                        count: 1,
                    },
                }});
        });

        it('should fail is something goes wrong with the initialization API calls', async() => {
            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    const error = new Error('very bad error');
                    throw error;
                });
            await invokeForFailure(handler, {
                lambdaARN: 'arnOK',
                lambdaConfigurations: {
                    initConfigurations: [{
                        powerValue: 128,
                        alias: 'RAM128',
                    }],
                    iterator: {
                        index: 0,
                        count: 1,
                    },
                }});
            expect(waitForFunctionUpdateCounter).to.be(1);
        });
    });

    describe('cleaner', async() => {

        const handler = require('../../lambda/cleaner').handler;

        let invalidEvents = [
            null,
            {},
            { lambdaARN: null, lambdaConfigurations: singleAliasConfig},
            { lambdaARN: '', lambdaConfigurations: singleAliasConfig},
            { lambdaARN: false, lambdaConfigurations: singleAliasConfig},
            { lambdaARN: 0, lambdaConfigurations: singleAliasConfig},
            { lambdaARN: '', lambdaConfigurations: singleAliasConfig},
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked without a lambdaARN - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        invalidEvents = [
            { lambdaARN: 'arnOK'},
            { lambdaARN: 'arnOK', lambdaConfigurations: {}},
            { lambdaARN: 'arnOK', lambdaConfigurations: { powerValues: []}},
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked without valid powerValues - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        it('should explode if invoked without lambdaConfigurations', async() => {
            await invokeForFailure(handler, {lambdaARN: 'arnOK'});
        });

        beforeEach('mock utilities', () => {
            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    return { FunctionVersion: '1' };
                });
            deleteLambdaAliasStub && deleteLambdaAliasStub.restore();
            deleteLambdaAliasStub = sandBox.stub(utils, 'deleteLambdaAlias')
                .callsFake(async() => {
                    return 'OK';
                });
            deleteLambdaVersionStub && deleteLambdaVersionStub.restore();
            deleteLambdaVersionStub = sandBox.stub(utils, 'deleteLambdaVersion')
                .callsFake(async() => {
                    return 'OK';
                });
        });

        const eventOK = {
            num: 10,
            lambdaARN: 'arnOK',
            lambdaConfigurations: {powerValues: ['128', '256', '512'] },
        };

        it('should invoke the given cb, when done', async() => {
            await invokeForSuccess(handler, eventOK);
        });

        it('should work fine even if the version does not exist', async() => {
            deleteLambdaVersionStub && deleteLambdaVersionStub.restore();
            deleteLambdaVersionStub = sandBox.stub(utils, 'deleteLambdaVersion')
                .callsFake(async() => {
                    const error = new ResourceNotFoundException('version is not defined');
                    throw error;
                });
            await invokeForSuccess(handler, eventOK);
        });

        it('should work fine even if the alias does not exist', async() => {
            deleteLambdaAliasStub && deleteLambdaAliasStub.restore();
            deleteLambdaAliasStub = sandBox.stub(utils, 'deleteLambdaAlias')
                .callsFake(async() => {
                    const error = new ResourceNotFoundException('alias is not defined');
                    throw error;
                });
            await invokeForSuccess(handler, eventOK);
        });

        it('should fail is something goes wrong with the cleaup API calls', async() => {
            deleteLambdaVersionStub && deleteLambdaVersionStub.restore();
            deleteLambdaVersionStub = sandBox.stub(utils, 'deleteLambdaVersion')
                .callsFake(async() => {
                    const error = new Error('very bad error');
                    throw error;
                });
            await invokeForFailure(handler, eventOK);
        });

        it('should work fine even with onlyColdStarts=true', async() => {
            await invokeForSuccess(handler, {
                num: 10,
                lambdaARN: 'arnOK',
                lambdaConfigurations: {powerValues: ['128', '256', '512'] },
                onlyColdStarts: true,
            });
        });

        it('should clean the right aliases with onlyColdStarts=false', async() => {
            const cleanedAliases = [];
            const expectedAliases = ['RAM128', 'RAM256', 'RAM512'];
            deleteLambdaAliasStub && deleteLambdaAliasStub.restore();
            deleteLambdaAliasStub = sandBox.stub(utils, 'deleteLambdaAlias')
                .callsFake(async(lambdaARN, alias) => {
                    cleanedAliases.push(alias);
                    return 'OK';
                });
            await invokeForSuccess(handler, {
                num: 10,
                lambdaARN: 'arnOK',
                lambdaConfigurations: {powerValues: ['128', '256', '512']},
                onlyColdStarts: false,
            });
            expect(cleanedAliases).to.eql(expectedAliases);
        });

        it('should clean the right aliases with onlyColdStarts=true', async() => {
            const cleanedAliases = [];
            const expectedAliases = ['RAM128-0', 'RAM128-1', 'RAM256-0', 'RAM256-1', 'RAM512-0', 'RAM512-1'];
            deleteLambdaAliasStub && deleteLambdaAliasStub.restore();
            deleteLambdaAliasStub = sandBox.stub(utils, 'deleteLambdaAlias')
                .callsFake(async(lambdaARN, alias) => {
                    cleanedAliases.push(alias);
                    return 'OK';
                });
            await invokeForSuccess(handler, {
                num: 2,
                lambdaARN: 'arnOK',
                lambdaConfigurations: {powerValues: ['128', '256', '512']},
                onlyColdStarts: true,
            });
            expect(cleanedAliases).to.eql(expectedAliases);
        });

    });

    describe('executor', () => {

        const handler = require('../../lambda/executor').handler;

        var invokeLambdaCounter,
            invokeLambdaPayloads,
            invokeProcessorCounter,
            fetchPayloadFromS3Counter,
            getLambdaConfigCounter;

        beforeEach('mock utilities', () => {
            invokeLambdaCounter = 0;
            invokeLambdaPayloads = [];
            invokeProcessorCounter = 0;
            fetchPayloadFromS3Counter = 0;
            getLambdaConfigCounter = 0;

            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    invokeLambdaCounter++;
                    invokeLambdaPayloads.push(payload);
                    // logs will always return 1ms duration with 128MB
                    return {
                        StatusCode: 200,
                        LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQ==',
                        ExecutedVersion: '$LATEST',
                        Payload: '{}',
                    };
                });

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    invokeProcessorCounter++;
                    invokeLambdaCounter++;
                    return '{"Processed": true}';
                });

            getLambdaConfigStub && getLambdaConfigStub.restore();
            getLambdaConfigStub = sandBox.stub(utils, 'getLambdaConfig')
                .callsFake(async(_arn, _alias) => {
                    getLambdaConfigCounter++;
                    return {
                        // return x86_64 or arm64 randomly
                        architecture: Math.floor(Math.random() * 2) === 0 ? 'x86_64' : 'arm64',
                        isPending: false,
                    };
                });

            fetchPayloadFromS3Stub && fetchPayloadFromS3Stub.restore();
            fetchPayloadFromS3Stub = sandBox.stub(utils, 'fetchPayloadFromS3')
                .callsFake(async(_arn, _alias, payload) => {
                    fetchPayloadFromS3Counter++;
                    return {ValueFromS3: 'OK'};
                });
        });

        let invalidEvents = [
            null,
            {},
            { lambdaARN: null },
            { lambdaARN: '' },
            { lambdaARN: false },
            { lambdaARN: 0 },
            { lambdaARN: 'arnOK' },
            { input: {lambdaARN: null} },
            { input: {lambdaARN: ''} },
            { input: {lambdaARN: false} },
            { input: {lambdaARN: 0} },
            { input: {lambdaARN: 'arnOK'} },
            { input: {lambdaARN: 'arnOK'}, value: null },
            { input: {lambdaARN: 'arnOK'}, value: 0 },
            { input: {lambdaARN: 'arnOK'}, value: 'invalid' },
            { input: {lambdaARN: 'arnOK'}, value: 128 }, // 128 is ok
            { input: {lambdaARN: 'arnOK'}, value: '128' }, // '128' is ok
            { input: {lambdaARN: 'arnOK', num: null}, value: 128 },
            { input: {lambdaARN: 'arnOK', num: 0}, value: 128 },
            { input: {lambdaARN: 'arnOK', num: 'invalid'}, value: 128 },
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked with invalid input - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        it('should invoke the given cb, when done', async() => {
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                },
            });
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done (isPending)', async() => {
            getLambdaConfigStub && getLambdaConfigStub.restore();
            getLambdaConfigStub = sandBox.stub(utils, 'getLambdaConfig')
                .callsFake(async(_arn) => {
                    getLambdaConfigCounter++;
                    return {architecture: 'x86_64', isPending: true};
                });
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                },
            });
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(1);
        });

        it('should invoke the given cb, when done (parallelInvocation)', async() => {
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    parallelInvocation: true,
                },
            });
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done with between function sleep', async() => {

            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    sleepBetweenRunsMs: 50,
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
            expect(sleepCounter).to.be(10);

        });

        it('should invoke the given cb, when done (parallelInvocation) and ignore function sleep', async() => {
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 20,
                    sleepBetweenRunsMs: 50,
                    parallelInvocation: true,
                },
            });
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
            expect(sleepCounter).to.be(0);
        });

        it('should invoke the given cb, when done with invalid function sleep', async() => {
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 100,
                    sleepBetweenRunsMs: 'Not a number',
                },
            });
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
            expect(sleepCounter).to.be(0);
        });

        it('should return statistics (default)', async() => {
            const response = await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                },
            });

            expect(response).to.be.an('object');
            expect(response.averagePrice).to.be.a('number');
            expect(response.averageDuration).to.be.a('number');
            expect(response.totalCost).to.be.a('number');
            expect(parseFloat(response.totalCost.toPrecision(10))).to.be(2.1e-8); // 10ms in total
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should return statistics (af-south-1)', async() => {
            const response = await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'af-south-1',
                    num: 10,
                },
            });

            expect(response).to.be.an('object');
            expect(response.averagePrice).to.be.a('number');
            expect(response.averageDuration).to.be.a('number');
            expect(response.totalCost).to.be.a('number');
            expect(parseFloat(response.totalCost.toPrecision(10))).to.be(2.8e-8); // 10ms in total
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done (custom payload)', async() => {
            const expectedPayload = { key1: 'value1', key2: 'value2' };
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: expectedPayload,
                },
            });

            expect(invokeLambdaPayloads.length).to.be(10);
            invokeLambdaPayloads.forEach(payload => {
                expect(payload).to.be(JSON.stringify(expectedPayload));
            });
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done (weighted payload)', async() => {
            const weightedPayload = [
                { payload: {test: 'A'}, weight: 10 },
                { payload: {test: 'B'}, weight: 30 },
                { payload: {test: 'C'}, weight: 60 },
            ];
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: weightedPayload,
                },
            });

            expect(invokeLambdaPayloads.length).to.be(10);
            const counters = {
                A: 0, B: 0, C: 0,
            };
            invokeLambdaPayloads.forEach(payload => {
                counters[JSON.parse(payload).test] += 1;
            });
            expect(counters.A).to.be(1);
            expect(counters.B).to.be(3);
            expect(counters.C).to.be(6);

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done (weighted payload 2)', async() => {
            const weightedPayload = [
                { payload: {test: 'A'}, weight: 5 },
                { payload: {test: 'B'}, weight: 15 },
                { payload: {test: 'C'}, weight: 30 },
            ];
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 100,
                    payload: weightedPayload,
                },
            });

            expect(invokeLambdaPayloads.length).to.be(100);
            const counters = {
                A: 0, B: 0, C: 0,
            };
            invokeLambdaPayloads.forEach(payload => {
                counters[JSON.parse(payload).test] += 1;
            });
            expect(counters.A).to.be(10);
            expect(counters.B).to.be(30);
            expect(counters.C).to.be(60);

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done (weighted payload 3)', async() => {
            const weightedPayload = [
                { payload: {test: 'A'}, weight: 1 },
                { payload: {test: 'B'}, weight: 1 },
                { payload: {test: 'C'}, weight: 1 },
            ];
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: weightedPayload,
                },
            });

            expect(invokeLambdaPayloads.length).to.be(10);
            invokeLambdaPayloads.forEach(payload => {
                expect(payload).to.be.a('string');
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should explode if count(payloads) < num', async() => {
            const weightedPayload = [
                { payload: {test: 'A'}, weight: 5 },
                { payload: {test: 'B'}, weight: 15 },
                { payload: {test: 'C'}, weight: 30 },
                { payload: {test: 'D'}, weight: 5 },
                { payload: {test: 'E'}, weight: 15 },
                { payload: {test: 'F'}, weight: 30 },
                { payload: {test: 'G'}, weight: 30 },
                { payload: {test: 'H'}, weight: 5 },
                { payload: {test: 'I'}, weight: 15 },
                { payload: {test: 'J'}, weight: 30 },
            ];

            expect(weightedPayload.length).to.be(10);

            await invokeForFailure(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 9, // num is too low here (# of payloads - 1)
                    payload: weightedPayload,
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke the given cb, when done (not enough weight)', async() => {
            const weightedPayload = [
                { payload: {test: 'A'}, weight: 10 },
                { payload: {test: 'B'}, weight: 60 },
                { payload: {test: 'C'}, weight: 30 },
            ];

            await invokeForFailure(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 5, // num is too low here (10% of 5 is 0.5, not enough times for payload A)
                    payload: weightedPayload,
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should explode if invalid weighted payloads', async() => {
            const invalidWeightedPayloads = [
                [], // empty array
                [1, 2, 3], // array of non-obj
                ['a', 'b', 'c'], // array of non-obj
                [
                    { payload: {test: 'A'}, weight: 5 },
                    { payload: {test: 'B'} }, // missing weight
                ],
                [
                    { payload: {test: 'A'}, weight: 5 },
                    { weight: 10}, // missing payload
                ],
            ];

            invalidWeightedPayloads.forEach(async(weightedPayload) => {
                await invokeForFailure(handler, {
                    value: '128',
                    input: {
                        lambdaARN: 'arnOK',
                        num: 100,
                        payload: weightedPayload,
                    },
                });
            });

            expect(getLambdaConfigCounter).to.be(0);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        [1, 10, 100].forEach(num => {
            it('should invoke Lambda ' + num + ' time(s)', async() => {
                await invokeForSuccess(handler, {
                    value: '128',
                    input: {
                        lambdaARN: 'arnOK',
                        num: num,
                    },
                });
                expect(invokeLambdaCounter).to.be(num);
                expect(getLambdaConfigCounter).to.be(1);
                expect(waitForAliasActiveCounter).to.be(0);
            });
            it('should invoke Lambda ' + num + ' time(s) in parallel', async() => {
                await invokeForSuccess(handler, {
                    value: '128',
                    input: {
                        lambdaARN: 'arnOK',
                        num: num,
                        parallelInvocation: true,
                    },
                });
                expect(invokeLambdaCounter).to.be(num);
                expect(getLambdaConfigCounter).to.be(1);
                expect(waitForAliasActiveCounter).to.be(0);
            });
        });

        it('should report an error if invocation fails', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });
            await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        const invokeForFailureInSeriesAndAssertOnErrorMessage = async({disablePayloadLogs, isPayloadInErrorMessage}) => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });
            const error = await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: 'SENTINEL',
                    disablePayloadLogs: disablePayloadLogs,
                },
            });

            expect(error.message.includes('SENTINEL')).to.be(isPayloadInErrorMessage);
            expect(error.message).to.contain('in series');

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        };

        it('should include payload in exception message if invocation fails and disablePayloadLogs is undefined (series)', async() => invokeForFailureInSeriesAndAssertOnErrorMessage({
            disablePayloadLogs: undefined,
            isPayloadInErrorMessage: true,
        }));

        it('should include payload in exception message if invocation fails and disablePayloadLogs is false (series)', async() => invokeForFailureInSeriesAndAssertOnErrorMessage({
            disablePayloadLogs: false,
            isPayloadInErrorMessage: true,
        }));

        it('should not include payload in exception message if invocation fails and disablePayloadLogs is true (series)', async() => invokeForFailureInSeriesAndAssertOnErrorMessage({
            disablePayloadLogs: true,
            isPayloadInErrorMessage: false,
        }));

        const invokeForFailureInParallelAndAssertOnErrorMessage = async({disablePayloadLogs, isPayloadInErrorMessage}) => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });
            const error = await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    parallelInvocation: true,
                    payload: 'SENTINEL',
                    disablePayloadLogs: disablePayloadLogs,
                },
            });

            expect(error.message.includes('SENTINEL')).to.be(isPayloadInErrorMessage);
            expect(error.message).to.contain('in parallel');

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        };

        it('should include payload in exception message if invocation fails and disablePayloadLogs is undefined (parallel)', async() => invokeForFailureInParallelAndAssertOnErrorMessage({
            disablePayloadLogs: undefined,
            isPayloadInErrorMessage: true,
        }));

        it('should include payload in exception message if invocation fails and disablePayloadLogs is false (parallel)', async() => invokeForFailureInParallelAndAssertOnErrorMessage({
            disablePayloadLogs: false,
            isPayloadInErrorMessage: true,
        }));

        it('should not include payload in exception message if invocation fails and disablePayloadLogs is true (parallel)', async() => invokeForFailureInParallelAndAssertOnErrorMessage({
            disablePayloadLogs: true,
            isPayloadInErrorMessage: false,
        }));

        it('should include weighted payload in exception message if invocation fails (series)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });
            const error = await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: [
                        {payload: {key: 'SENTINEL1'}, weight: 1},
                        {payload: {key: 'SENTINEL2'}, weight: 1},
                    ],
                },
            });

            expect(error.message).to.contain('SENTINEL1');
            expect(error.message).to.contain('in series');

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should include weighted payload in exception message if invocation fails (parallel)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });
            const error = await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    parallelInvocation: true,
                    payload: [
                        {payload: 'SENTINEL1', weight: 1},
                        {payload: 'SENTINEL2', weight: 1},
                    ],
                },
            });

            expect(error.message).to.contain('SENTINEL1');
            expect(error.message).to.contain('in parallel');

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should report an error if invocation fails (parallel)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });
            await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    parallelInvocation: true,
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should return price as output', async() => {
            const stats = await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                },
            });
            expect(stats.averagePrice).to.be.a('number');
            expect(stats.averageDuration).to.be.a('number');

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should run only once if dryRun', async() => {
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 1000,
                    dryRun: true,
                },
            });
            expect(invokeLambdaCounter).to.be(1);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke pre-processor', async() => {
            const num = 10;
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: num,
                    preProcessorARN: 'preArnOK',
                },
            });
            expect(invokeLambdaCounter).to.be(num * 2);
            expect(invokeProcessorCounter).to.be(num);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke post-processor', async() => {
            const num = 10;
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: num,
                    postProcessorARN: 'postArnOK',
                },
            });
            expect(invokeLambdaCounter).to.be(num * 2);
            expect(invokeProcessorCounter).to.be(num);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke pre-processor and post-processor', async() => {
            const num = 10;
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: num,
                    preProcessorARN: 'preArnOK',
                    postProcessorARN: 'postArnOK',
                },
            });
            expect(invokeLambdaCounter).to.be(num * 3);
            expect(invokeProcessorCounter).to.be(num * 2);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke function with pre-processor output', async() => {
            const num = 10;
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: num,
                    preProcessorARN: 'preArnOK',
                },
            });
            expect(invokeLambdaPayloads[0].includes('Processed')).to.be(true);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should invoke function with original payload if pre-precessor does not return a new payload', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    invokeProcessorCounter++;
                    invokeLambdaCounter++;
                    return null; // empty output from pre-processor
                });

            const num = 10;
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: num,
                    payload: {Original: true},
                    preProcessorARN: 'preArnOK',
                },
            });
            expect(invokeLambdaPayloads[0].includes('Original')).to.be(true);

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should explode if pre-processor fails', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    throw new Error('PreProcessor XXX failed with error YYY and payload ZZZ');
                });

            await invokeForFailure(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: {Original: true},
                    preProcessorARN: 'preArnOK',
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should explode if post-processor fails', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    throw new Error('PostProcessor XXX failed with error YYY and payload ZZZ');
                });

            await invokeForFailure(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: {Original: true},
                    postProcessorARN: 'postArnOK',
                },
            });

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should explode with processed payload in case of execution error (series)', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    invokeProcessorCounter++;
                    invokeLambdaCounter++;
                    return {Processed: true};
                });

            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });

            const error = await invokeForFailure(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: {Original: true},
                    preProcessorARN: 'postArnOK',
                },
            });

            expect(error.message).to.contain('in series');
            expect(error.message).to.contain(JSON.stringify({Processed: true}));

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should explode with processed payload in case of execution error (parallel)', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    invokeProcessorCounter++;
                    invokeLambdaCounter++;
                    return {Processed: true};
                });

            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });

            const error = await invokeForFailure(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: {Original: true},
                    parallelInvocation: true,
                    preProcessorARN: 'postArnOK',
                },
            });

            expect(error.message).to.contain('in parallel');
            expect(error.message).to.contain(JSON.stringify({Processed: true}));

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });


        it('should pass with processed payload in case of execution error (parallel) where error is in allowedExceptions', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    invokeProcessorCounter++;
                    invokeLambdaCounter++;
                    return {Processed: true};
                });

            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    invokeLambdaPayloads.push(payload);
                    return {
                        FunctionError: 'HandledError',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "HandledError", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });

           await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 1,
                    payload: {Original: true},
                    parallelInvocation: true,
                    allowedExceptions: ['HandledError']
                },
            });


            expect(invokeLambdaPayloads[0].includes('Original')).to.be(true);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should pass with processed payload in case of execution error (series) where error is in allowedExceptions', async() => {

            invokeLambdaProcessorStub && invokeLambdaProcessorStub.restore();
            invokeLambdaProcessorStub = sandBox.stub(utils, 'invokeLambdaProcessor')
                .callsFake(async(_arn, _payload, _preOrPost) => {
                    invokeProcessorCounter++;
                    invokeLambdaCounter++;
                    return {Processed: true};
                });

            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    invokeLambdaPayloads.push(payload);
                    return {
                        FunctionError: 'HandledError',
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "HandledError", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                    };
                });

           await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 1,
                    payload: {Original: true},
                    allowedExceptions: ['HandledError']
                },
            });


            expect(invokeLambdaPayloads[0].includes('Original')).to.be(true);
            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });



        it('should fetch payload from S3 if payloadS3 is given', async() => {

            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 50,
                    payloadS3: 's3://my-bucket/my-key.json',
                },
            });
            expect(fetchPayloadFromS3Counter).to.be(1);
            for (let payload of invokeLambdaPayloads){
                expect(payload).to.be('{"ValueFromS3":"OK"}');
            }

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should fetch payload from S3 if both payload and payloadS3 are given', async() => {

            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 50,
                    payloadS3: 's3://my-bucket/my-key.json',
                    payload: '{"ValueInline": "OK"}', // won't be used
                },
            });
            expect(fetchPayloadFromS3Counter).to.be(1);
            for (let payload of invokeLambdaPayloads){
                expect(payload).to.be('{"ValueFromS3":"OK"}');
            }

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        it('should generate weighted payload from S3', async() => {
            fetchPayloadFromS3Stub && fetchPayloadFromS3Stub.restore();
            fetchPayloadFromS3Stub = sandBox.stub(utils, 'fetchPayloadFromS3')
                .callsFake(async(_arn, _alias, payload) => {
                    fetchPayloadFromS3Counter++;
                    return [
                        { payload: {test: 'A'}, weight: 10 },
                        { payload: {test: 'B'}, weight: 30 },
                        { payload: {test: 'C'}, weight: 60 },
                    ];
                });

            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payloadS3: 's3://my-bucket/my-key.json',
                },
            });

            expect(fetchPayloadFromS3Counter).to.be(1);
            expect(invokeLambdaPayloads.length).to.be(10);
            const counters = {
                A: 0, B: 0, C: 0,
            };
            invokeLambdaPayloads.forEach(payload => {
                counters[JSON.parse(payload).test] += 1;
            });
            expect(counters.A).to.be(1);
            expect(counters.B).to.be(3);
            expect(counters.C).to.be(6);

            expect(getLambdaConfigCounter).to.be(1);
            expect(waitForAliasActiveCounter).to.be(0);
        });

        const discardTopBottomValues = [
            // set to 0.4, maximum value
            0.7,
            0.4,
            // default value
            0.2,
            // no trimming
            0,
        ];
        const trimmedDurationsValues = [
            3.5,
            3.5,
            4.416666666666667,
            27.72,
        ];

        const logResults = [
            // Duration 0.1ms - Init Duration 0.1ms - Billed 1ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMC4xIG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcwlJbml0IER1cmF0aW9uOiAwLjEgbXMgCU1lbW9yeSBTaXplOiAxMjggTUIJTWF4IE1lbW9yeSBVc2VkOiAxNSBNQgkK',
                Payload: 'null',
            },
            // Duration 0.5ms - Billed 1ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMC41IG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQo=',
                Payload: 'null',
            },
            // Duration 2.0ms - Billed 2ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkgMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQgMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQgMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQgRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkIFJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMi4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMiBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQ==',
                Payload: 'null',
            },
            // Duration 3.0ms - Billed 3ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMyBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQo=',
                Payload: 'null',
            },
            // Duration 3.0ms - Billed 3ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMyBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQo=',
                Payload: 'null',
            },
            // Duration 4.0ms - Billed 4ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogNC4wIG1zCUJpbGxlZCBEdXJhdGlvbjogNCBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQo=',
                Payload: 'null',
            },
            // Duration 4.5ms - Billed 5ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogNC41IG1zCUJpbGxlZCBEdXJhdGlvbjogNSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1CCQo=',
                Payload: 'null',
            },
            // Duration 10.0ms - Billed 10ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMTAuMCBtcwlCaWxsZWQgRHVyYXRpb246IDEwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==',
                Payload: 'null',
            },
            // Duration 50ms - Billed 50ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogNTAuMCBtcwlCaWxsZWQgRHVyYXRpb246IDUwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==',
                Payload: 'null',
            },
            // Duration 200ms - Billed 200ms
            {
                StatusCode: 200,
                LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMjAwLjAgbXMJQmlsbGVkIER1cmF0aW9uOiAyMDAgbXMgCU1lbW9yeSBTaXplOiAxMjggTUIJTWF4IE1lbW9yeSBVc2VkOiAxNSBNQgkK',
                Payload: 'null',
            },
        ];

        discardTopBottomValues.forEach((discardTopBottomValue, forEachIndex) => {
            console.log('extractDiscardTopBottomValue', discardTopBottomValue);
            it(`should discard ${discardTopBottomValue * 100}% of durations`, async() => {
                let invokeCounter = 0;
                invokeLambdaStub && invokeLambdaStub.restore();
                invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                    .callsFake(async(_arn, _alias, payload) => {
                        invokeLambdaPayloads.push(payload);
                        const logResult = logResults[invokeCounter];
                        invokeCounter++;

                        return logResult;
                    });

                const response = await invokeForSuccess(handler, {
                    value: '128',
                    input: {
                        lambdaARN: 'arnOK',
                        num: 10,
                        discardTopBottom: discardTopBottomValue,
                    },
                });

                console.log('response', response);

                expect(response.averageDuration).to.be(trimmedDurationsValues[forEachIndex]);
            });
        });

        it('should default discardTopBottom to 0 when onlyColdStarts', async() => {
            let invokeCounter = 0;
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    invokeLambdaPayloads.push(payload);
                    const logResult = logResults[invokeCounter];
                    invokeCounter++;

                    return logResult;
                });

            const response = await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    onlyColdStarts: true,
                },
            });

            console.log('response', response);

            expect(response.averageDuration).to.be(27.72);
        });

        it('should waitForAliasActive for each Alias when onlyColdStarts is set', async() => {
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    onlyColdStarts: true,
                    parallelInvocation: true,
                },
            });
            expect(waitForAliasActiveCounter).to.be(10);
        });

        it('should invoke each Alias once when onlyColdStarts is set', async() => {
            const aliasesToInvoke = ['RAM128-0', 'RAM128-1', 'RAM128-2', 'RAM128-3', 'RAM128-4'];
            let invokedAliases = [];
            let invokeCounter = 0;
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    invokedAliases.push(_alias);
                    invokeLambdaPayloads.push(payload);
                    const logResult = logResults[invokeCounter];
                    invokeCounter++;

                    return logResult;
                });
            await invokeForSuccess(handler, {
                value: '128',
                input: {
                    lambdaARN: 'arnOK',
                    num: 5,
                    onlyColdStarts: true,
                    parallelInvocation: true,
                },
            });
            expect(waitForAliasActiveCounter).to.be(5);
            expect(invokedAliases).to.eql(aliasesToInvoke);
        });
    });

    describe('analyzer', () => {

        const handler = require('../../lambda/analyzer').handler;

        let invalidEvents = [
            null,
            {},
            [],
            { lambdaARN: '' },
            { whatever: 1 },
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked without invalid event - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        it('should also return the total cost of execution', async() => {
            const event = {
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 100, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 300, totalCost: 2 },
                    { value: '512', averagePrice: 30, averageDuration: 200, totalCost: 3 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(30);
            expect(result.duration).to.be(200);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(6);
        });

        it('should also return visualization URL', async() => {
            const event = {
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 100, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 300, totalCost: 2 },
                    { value: '512', averagePrice: 30, averageDuration: 200, totalCost: 3 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.visualization).to.be.a('string');
        });

        it('should return the cheapest power configuration if no strategy', async() => {
            const event = {
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 100, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 300, totalCost: 3 },
                    { value: '512', averagePrice: 30, averageDuration: 200, totalCost: 5 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(30);
            expect(result.duration).to.be(200);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(9);
        });

        it('should return the cheapest power configuration if cost strategy', async() => {
            const event = {
                strategy: 'cost',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 100, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 300, totalCost: 6 },
                    { value: '512', averagePrice: 30, averageDuration: 200, totalCost: 9 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(30);
            expect(result.duration).to.be(200);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(16);
        });

        it('should return the cheapest and fastest power configuration if cost strategy and same cost', async() => {
            const event = {
                strategy: 'cost',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 100, totalCost: 1 },
                    { value: '256', averagePrice: 100, averageDuration: 90, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 200, totalCost: 9 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('256');
            expect(result.cost).to.be(100);
            expect(result.duration).to.be(90);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(11);
        });

        it('should return the fastest power configuration if speed strategy', async() => {
            const event = {
                strategy: 'speed',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 100, totalCost: 1 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(300);
            expect(result.duration).to.be(100);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(3);
        });

        it('should return the fastest and cheapest power configuration if speed strategy and same duration', async() => {
            const event = {
                strategy: 'speed',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 200, totalCost: 1 },
                    { value: '256', averagePrice: 90, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 400, totalCost: 1 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('256');
            expect(result.cost).to.be(90);
            expect(result.duration).to.be(200);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(3);
        });

        it('should return the cheapest power configuration if balanced strategy with weight = 1', async() => {
            const event = {
                strategy: 'balanced',
                balancedWeight: 1,
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 100, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 300, totalCost: 6 },
                    { value: '512', averagePrice: 30, averageDuration: 200, totalCost: 9 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(30);
            expect(result.duration).to.be(200);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(16);
        });

        it('should return the fastest power configuration if balanced strategy with weight = 0', async() => {
            const event = {
                strategy: 'balanced',
                balancedWeight: 0,
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 100, totalCost: 1 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(300);
            expect(result.duration).to.be(100);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(3);
        });

        it('should return a balanced power configuration if balanced strategy with default weight', async() => {
            const event = {
                strategy: 'balanced',
                stats: [
                    { value: '128', averagePrice: 101, averageDuration: 300, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 101, totalCost: 1 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('256');
            expect(result.cost).to.be(200);
            expect(result.duration).to.be(200);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(3));
            expect(result.stateMachine.lambdaCost).to.be(3);
        });

        it('should return a balanced power configuration if balanced strategy with custom weight', async() => {
            const event = {
                strategy: 'balanced',
                balancedWeight: 0.3,
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 100, totalCost: 1 },
                    { value: '1024', averagePrice: 1000, averageDuration: 50, totalCost: 1 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');
            expect(result.power).to.be('512');
            expect(result.cost).to.be(300);
            expect(result.duration).to.be(100);
            expect(result.stateMachine).to.be.an('object');
            expect(result.stateMachine.executionCost).to.be(utils.stepFunctionsCost(4));
            expect(result.stateMachine.lambdaCost).to.be(4);
        });

        it('should return nothing if dryRun', async() => {
            const event = {
                strategy: 'cost',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                ],
                dryRun: true,
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be(undefined);
        });

        const invalidStrategies = [
            'foobar', // doesn't exist
            'Balanced', // capitalized
            ' ',
            '-',
        ];

        invalidStrategies.forEach(strategy => {

            it(`should explode if invalid strategy - "${strategy}"`, async() => {

                const event = {
                    strategy: strategy,
                    stats: [
                        { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                        { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                        { value: '512', averagePrice: 300, averageDuration: 100, totalCost: 1 },
                    ],
                };

                await invokeForFailure(handler, event);

            });

        });

        it('should output all results if "includeOutputResults" is set to true', async() => {
            const event = {
                strategy: 'speed',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 100, totalCost: 1 },
                ],
                includeOutputResults: true,
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');

            expect(result).to.have.property('stats');
            expect(result.stats).to.eql(event.stats.map(stat => ({
                value: stat.value,
                averagePrice: stat.averagePrice,
                averageDuration: stat.averageDuration,
            })));

            expect(result.stats[0]).to.not.have.property('totalCost');

            expect(result).to.have.property('power');
            expect(result).to.have.property('cost');
            expect(result).to.have.property('duration');
            expect(result.stateMachine).to.be.an('object');

        });

        it('should not output any results if "includeOutputResults" is set to false', async() => {
            const event = {
                strategy: 'speed',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                ],
                includeOutputResults: false,
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');

            expect(result).to.not.have.property('stats');
            expect(result).to.have.property('power');
            expect(result).to.have.property('cost');
            expect(result).to.have.property('duration');
            expect(result.stateMachine).to.be.an('object');
        });

        it('should not output any results if "includeOutputResults" is not set', async() => {
            const event = {
                strategy: 'speed',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                ],
            };

            const result = await invokeForSuccess(handler, event);
            expect(result).to.be.an('object');

            expect(result).to.not.have.property('stats');
            expect(result).to.have.property('power');
            expect(result).to.have.property('cost');
            expect(result).to.have.property('duration');
            expect(result.stateMachine).to.be.an('object');
        });

    });

    describe('optimizer', async() => {

        const handler = require('../../lambda/optimizer').handler;

        beforeEach('mock utilities', () => {

            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    const error = new ResourceNotFoundException('alias is not defined');
                    throw error;
                });
            setLambdaPowerStub && setLambdaPowerStub.restore();
            setLambdaPowerStub = sandBox.stub(utils, 'setLambdaPower')
                .callsFake(async() => {
                    setLambdaPowerCounter++;
                    return 'OK';
                });
            publishLambdaVersionStub && publishLambdaVersionStub.restore();
            publishLambdaVersionStub = sandBox.stub(utils, 'publishLambdaVersion')
                .callsFake(async() => {
                    publishLambdaVersionCounter++;
                    return { Version: 1 };
                });
            createLambdaAliasStub && createLambdaAliasStub.restore();
            createLambdaAliasStub = sandBox.stub(utils, 'createLambdaAlias')
                .callsFake(async() => {
                    createLambdaAliasCounter++;
                    return 'OK';
                });
            updateLambdaAliasStub && updateLambdaAliasStub.restore();
            updateLambdaAliasStub = sandBox.stub(utils, 'updateLambdaAlias')
                .callsFake(async() => {
                    updateLambdaAliasCounter++;
                    return 'OK';
                });
        });


        let invalidEvents = [
            {},
            { lambdaARN: null },
            { lambdaARN: '' },
            { lambdaARN: false },
            { lambdaARN: 0 },
            { lambdaARN: '', analysis: null },
            { lambdaARN: 'arnOK', analysis: {} },
            { lambdaARN: 'arnOK', analysis: { power: null} },
        ];

        invalidEvents.forEach(async(event) => {
            it('should explode if invoked without lambdaARN or optimal power - ' + JSON.stringify(event), async() => {
                await invokeForFailure(handler, event);
            });
        });

        it('should not do anything if invoked without autoOptimize', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                analysis: {power: 128},
            });
            expect(setLambdaPowerCounter).to.be(0);
            expect(publishLambdaVersionCounter).to.be(0);
            expect(createLambdaAliasCounter).to.be(0);
            expect(updateLambdaAliasCounter).to.be(0);
        });

        it('should not do anything if dryRun', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                analysis: {power: 128},
                autoOptimize: true,
                dryRun: true,
            });
            expect(setLambdaPowerCounter).to.be(0);
            expect(publishLambdaVersionCounter).to.be(0);
            expect(createLambdaAliasCounter).to.be(0);
            expect(updateLambdaAliasCounter).to.be(0);
        });

        it('should not do anything if dryRun without any analysis', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                autoOptimize: true,
                dryRun: true,
            });
            expect(setLambdaPowerCounter).to.be(0);
            expect(publishLambdaVersionCounter).to.be(0);
            expect(createLambdaAliasCounter).to.be(0);
            expect(updateLambdaAliasCounter).to.be(0);
        });

        it('should update power if invoked with autoOptimize', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                analysis: {power: 128},
                autoOptimize: true,
            });
            expect(setLambdaPowerCounter).to.be(1);
            expect(publishLambdaVersionCounter).to.be(0);
            expect(createLambdaAliasCounter).to.be(0);
            expect(updateLambdaAliasCounter).to.be(0);
        });

        it('should create alias if invoked with autoOptimizeAlias', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                analysis: {power: 128},
                autoOptimize: true,
                autoOptimizeAlias: 'prod',
            });
            expect(setLambdaPowerCounter).to.be(1);
            expect(publishLambdaVersionCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(1);
            expect(updateLambdaAliasCounter).to.be(0);
        });

        it('should update alias if invoked with autoOptimizeAlias and alias already exists', async() => {
            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    return { FunctionVersion: '1' };
                });
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                analysis: {power: 128},
                autoOptimize: true,
                autoOptimizeAlias: 'prod',
            });
            expect(setLambdaPowerCounter).to.be(1);
            expect(publishLambdaVersionCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(0);
            expect(updateLambdaAliasCounter).to.be(1);
        });
    });
});
