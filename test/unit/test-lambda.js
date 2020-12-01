'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

var AWS = require('aws-sdk-mock');
const utils = require('../../lambda/utils');

// mock all the Lambda API's
AWS.mock('Lambda', 'getAlias', {});
AWS.mock('Lambda', 'updateFunctionConfiguration', {});
AWS.mock('Lambda', 'publishVersion', {});
AWS.mock('Lambda', 'deleteFunction', {});
AWS.mock('Lambda', 'createAlias', {});
AWS.mock('Lambda', 'updateAlias', {});
AWS.mock('Lambda', 'deleteAlias', {});
AWS.mock('Lambda', 'invoke', {});

// mock environment variables and context
const powerValues = [128, 256, 512, 1024];
process.env.defaultPowerValues = powerValues.join(',');
process.env.minRAM = 128;
process.env.baseCosts = '{"ap-east-1":2.9e-9,"af-south-1":2.8e-9,"me-south-1":2.6e-9,"eu-south-1":2.4e-9,"default":2.1e-9}';
const fakeContext = {};

// variables used during tests
var setLambdaPowerCounter,
    getLambdaPowerCounter,
    publishLambdaVersionCounter,
    createLambdaAliasCounter,
    updateLambdaAliasCounter;

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

// utility to invoke handler (success case)
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
    deleteLambdaAliasStub;

/** unit tests below **/

describe('Lambda Functions', async() => {

    beforeEach('mock utilities', () => {
        setLambdaPowerCounter = 0;
        getLambdaPowerCounter = 0;
        publishLambdaVersionCounter = 0;
        createLambdaAliasCounter = 0;
        updateLambdaAliasCounter = 0;

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
                const error = new Error('alias is not defined');
                error.code = 'ResourceNotFoundException';
                throw error;
            });
        sandBox.stub(utils, 'getLambdaPower')
            .callsFake(async() => {
                getLambdaPowerCounter++;
                return 1024;
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
    });

    afterEach('Global mock utilities afterEach', () => {
        // restore everything to its natural order
        sandBox.restore();
    });

    describe('initializer', async() => {

        const handler = require('../../lambda/initializer').handler;

        it('should explode if invoked without a lambdaARN', async() => {
            const invalidEvents = [
                null,
                {},
                { lambdaARN: null },
                { lambdaARN: '' },
                { lambdaARN: false },
                { lambdaARN: 0 },
            ];
            invalidEvents.forEach(event => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
            });

            expect(async() => {
                await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            }).to.not.throwError();
        });

        it('should explode if invoked with a low num', async() => {
            const invalidEvents = [
                { num: -1, lambdaARN: 'arnOK' },
                { num: 0, lambdaARN: 'arnOK' },
                { num: 1, lambdaARN: 'arnOK' },
                { num: 2, lambdaARN: 'arnOK' },
                { num: 3, lambdaARN: 'arnOK' },
                { num: 4, lambdaARN: 'arnOK' },
            ];
            invalidEvents.forEach(event => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
            });

            expect(async() => {
                await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            }).to.not.throwError();

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
            expect(generatedValues.length).to.be(46);
        });

        it('should create N aliases and versions', async() => {
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });

            // +1 because it will also reset power to its initial value
            expect(setLambdaPowerCounter).to.be(powerValues.length + 1);

            expect(getLambdaPowerCounter).to.be(1);
            expect(publishLambdaVersionCounter).to.be(powerValues.length);
            expect(createLambdaAliasCounter).to.be(powerValues.length);
        });

        it('should update an alias if it already exists', async() => {
            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async(lambdaARN, alias) => {
                    if (alias === 'RAM128') {
                        return { FunctionVersion: '1' };
                    } else {
                        const error = new Error('alias is not defined');
                        error.code = 'ResourceNotFoundException';
                        throw error;
                    }
                });
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            expect(updateLambdaAliasCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(powerValues.length - 1);
        });

        it('should update an alias if it already exists (2)', async() => {
            createLambdaAliasStub && createLambdaAliasStub.restore();
            createLambdaAliasStub = sandBox.stub(utils, 'createLambdaAlias')
                .callsFake(async() => {
                    createLambdaAliasCounter += 10;
                    throw new Error('Alias already exists');
                });
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            expect(createLambdaAliasCounter).to.be(powerValues.length * 10);
        });

        it('should explode if something goes wrong during power set', async() => {
            setLambdaPowerStub && setLambdaPowerStub.restore();
            setLambdaPowerStub = sandBox.stub(utils, 'setLambdaPower')
                .callsFake(async() => {
                    throw new Error('Something went wrong');
                });
            await invokeForFailure(handler, { lambdaARN: 'arnOK', num: 5 });
        });

        it('should fail is something goes wrong with the initialization API calls', async() => {
            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    const error = new Error('very bad error');
                    error.code = 'VeryBadError';
                    throw error;
                });
            await invokeForFailure(handler, { lambdaARN: 'arnOK', num: 5 });
        });

    });

    describe('cleaner', async() => {

        const handler = require('../../lambda/cleaner').handler;

        it('should explode if invoked without a lambdaARN', async() => {
            const invalidEvents = [
                null,
                {},
                { lambdaARN: null },
                { lambdaARN: '' },
                { lambdaARN: false },
                { lambdaARN: 0 },
            ];
            invalidEvents.forEach(async(event) => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
            });
        });

        it('should explode if invoked without powerValues', async() => {
            expect(async() => {
                await invokeForFailure(handler, {lambdaARN: 'arnOK'});
            }).to.not.throwError();
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

        const eventOK = { lambdaARN: 'arnOK', powerValues: ['128', '256', '512'] };

        it('should invoke the given cb, when done', async() => {
            await invokeForSuccess(handler, eventOK);
        });

        it('should work fine even if the version does not exist', async() => {
            deleteLambdaVersionStub && deleteLambdaVersionStub.restore();
            deleteLambdaVersionStub = sandBox.stub(utils, 'deleteLambdaVersion')
                .callsFake(async() => {
                    const error = new Error('version is not defined');
                    error.code = 'ResourceNotFoundException';
                    throw error;
                });
            await invokeForSuccess(handler, eventOK);
        });

        it('should work fine even if the alias does not exist', async() => {
            deleteLambdaAliasStub && deleteLambdaAliasStub.restore();
            deleteLambdaAliasStub = sandBox.stub(utils, 'deleteLambdaAlias')
                .callsFake(async() => {
                    const error = new Error('alias is not defined');
                    error.code = 'ResourceNotFoundException';
                    throw error;
                });
            await invokeForSuccess(handler, eventOK);
        });

        it('should fail is something goes wrong with the cleaup API calls', async() => {
            deleteLambdaVersionStub && deleteLambdaVersionStub.restore();
            deleteLambdaVersionStub = sandBox.stub(utils, 'deleteLambdaVersion')
                .callsFake(async() => {
                    const error = new Error('very bad error');
                    error.code = 'VeryBadError';
                    throw error;
                });
            await invokeForFailure(handler, eventOK);
        });

    });

    describe('executor', () => {

        const handler = require('../../lambda/executor').handler;

        var invokeLambdaCounter,
            invokeLambdaPayloads,
            invokeProcessorCounter;

        beforeEach('mock utilities', () => {
            invokeLambdaCounter = 0;
            invokeLambdaPayloads = [];
            invokeProcessorCounter = 0;

            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    invokeLambdaCounter++;
                    invokeLambdaPayloads.push(payload);
                    // logs will always return 1ms duration with 128MB
                    return {
                        StatusCode: 200,
                        LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMS4wIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==',
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
        });

        it('should explode if invoked with invalid input', async() => {
            const invalidEvents = [
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

            invalidEvents.forEach(event => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
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
            expect(parseFloat(response.totalCost.toPrecision(10))).to.be(2.1e-8);  // 10ms in total
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
            });
        });

        it('should report an error if invocation fails', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
                    };
                });
            await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                },
            });
        });

        it('should include payload in exception message if invocation fails (series)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
                    };
                });
            const error = await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    payload: 'SENTINEL',
                },
            });

            expect(error.message).to.contain('SENTINEL');
            expect(error.message).to.contain('in series');
        });

        it('should include payload in exception message if invocation fails (parallel)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
                    };
                });
            const error = await invokeForFailure(handler, {
                value: '1024',
                input: {
                    lambdaARN: 'arnOK',
                    num: 10,
                    parallelInvocation: true,
                    payload: 'SENTINEL',
                },
            });

            expect(error.message).to.contain('SENTINEL');
            expect(error.message).to.contain('in parallel');
        });


        it('should include weighted payload in exception message if invocation fails (series)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
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
        });

        it('should include weighted payload in exception message if invocation fails (parallel)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
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
        });

        it('should report an error if invocation fails (parallel)', async() => {
            invokeLambdaStub && invokeLambdaStub.restore();
            invokeLambdaStub = sandBox.stub(utils, 'invokeLambda')
                .callsFake(async(_arn, _alias, payload) => {
                    return {
                        FunctionError: 'Unhandled',
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
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
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
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
                        Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
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

        });

    });

    describe('analyzer', () => {

        const handler = require('../../lambda/analyzer').handler;

        it('should explode if invoked without invalid event', async() => {
            const invalidEvents = [
                null,
                {},
                [],
                { lambdaARN: '' },
                { whatever: 1 },
            ];
            invalidEvents.forEach(event => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
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

        it('should explode if invalid strategy', async() => {
            const event = {
                strategy: 'foobar',
                stats: [
                    { value: '128', averagePrice: 100, averageDuration: 300, totalCost: 1 },
                    { value: '256', averagePrice: 200, averageDuration: 200, totalCost: 1 },
                    { value: '512', averagePrice: 300, averageDuration: 100, totalCost: 1 },
                ],
            };

            expect(async() => {
                await invokeForFailure(handler, event);
            }).to.not.throwError();
        });

    });

    describe('optimizer', async() => {

        const handler = require('../../lambda/optimizer').handler;

        beforeEach('mock utilities', () => {

            getLambdaAliasStub && getLambdaAliasStub.restore();
            getLambdaAliasStub = sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    const error = new Error('alias is not defined');
                    error.code = 'ResourceNotFoundException';
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

        it('should explode if invoked without lambdaARN or optimal power', async() => {
            const invalidEvents = [
                {},
                { lambdaARN: null },
                { lambdaARN: '' },
                { lambdaARN: false },
                { lambdaARN: 0 },
                { lambdaARN: '', analysis: null },
                { lambdaARN: 'arnOK', analysis: {} },
                { lambdaARN: 'arnOK', analysis: { power: null} },
            ];
            invalidEvents.forEach(event => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
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
