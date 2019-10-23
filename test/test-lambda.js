'use strict';

const expect = require('expect.js');

var AWS = require('aws-sdk-mock');
const utils = require('../lambda/utils');

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
process.env.minCost = 2.08e-7;
const fakeContext = {};

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


/** unit tests below **/

describe('Lambda Functions', async() => {

    describe('initializer', async() => {

        const handler = require('../lambda/initializer').handler;

        var setLambdaPowerCounter,
            getLambdaPowerCounter,
            publishLambdaVersionCounter,
            createLambdaAliasCounter,
            updateLambdaAliasCounter;

        beforeEach('mock utilities', () => {
            setLambdaPowerCounter = 0;
            getLambdaPowerCounter = 0;
            publishLambdaVersionCounter = 0;
            createLambdaAliasCounter = 0;
            updateLambdaAliasCounter = 0;
            // TODO use real mock (not override!)
            utils.getLambdaAlias = async() => {
                const error = new Error('alias is not defined');
                error.code = 'ResourceNotFoundException';
                throw error;
            };
            utils.getLambdaPower = async() => {
                getLambdaPowerCounter++;
                return 1024;
            };
            utils.setLambdaPower = async() => {
                setLambdaPowerCounter++;
                return 'OK';
            };
            utils.publishLambdaVersion = async() => {
                publishLambdaVersionCounter++;
                return { Version: 1 };
            };
            utils.createLambdaAlias = async() => {
                createLambdaAliasCounter++;
                return 'OK';
            };
            utils.updateLambdaAlias = async() => {
                updateLambdaAliasCounter++;
                return 'OK';
            };
        });

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
            // TODO use real mock (not override!)
            utils.getLambdaAlias = async(lambdaARN, alias) => {
                if (alias === 'RAM128') {
                    return { FunctionVersion: '1' };
                } else {
                    const error = new Error('alias is not defined');
                    error.code = 'ResourceNotFoundException';
                    throw error;
                }
            };
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            expect(updateLambdaAliasCounter).to.be(1);
            expect(createLambdaAliasCounter).to.be(powerValues.length - 1);
        });

        it('should update an alias if it already exists (2)', async() => {
            // TODO use real mock (not override!)
            utils.createLambdaAlias = async(lambdaARN, alias) => {
                createLambdaAliasCounter += 10;
                throw new Error('Alias already exists');
            };
            await invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            expect(createLambdaAliasCounter).to.be(powerValues.length * 10);
        });

        it('should explode if something goes wrong during power set', async() => {
            // TODO use real mock (not override!)
            utils.setLambdaPower = async() => {
                throw new Error('Something went wrong');
            };
            await invokeForFailure(handler, { lambdaARN: 'arnOK', num: 5 });
        });

        it('should fail is something goes wrong with the initialization API calls', async() => {
            // TODO use real mock (not override!)
            utils.getLambdaAlias = async() => {
                const error = new Error('very bad error');
                error.code = 'VeryBadError';
                throw error;
            };
            await invokeForFailure(handler, { lambdaARN: 'arnOK', num: 5 });
        });

    });

    describe('cleaner', async() => {

        const handler = require('../lambda/cleaner').handler;

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
            // TODO use real mock (not override!)
            utils.getLambdaAlias = async() => {
                return { FunctionVersion: '1' };
            };
            utils.deleteLambdaAlias = async() => {
                return 'OK';
            };
            utils.deleteLambdaVersion = async() => {
                return 'OK';
            };
        });

        const eventOK = { lambdaARN: 'arnOK', powerValues: ['128', '256', '512'] };

        it('should invoke the given cb, when done', async() => {
            await invokeForSuccess(handler, eventOK);
        });

        it('should work fine even if the version does not exist', async() => {
            // TODO use real mock (not override!)
            utils.deleteLambdaVersion = async() => {
                const error = new Error('version is not defined');
                error.code = 'ResourceNotFoundException';
                throw error;
            };
            await invokeForSuccess(handler, eventOK);
        });

        it('should work fine even if the alias does not exist', async() => {
            // TODO use real mock (not override!)
            utils.deleteLambdaAlias = async() => {
                const error = new Error('alias is not defined');
                error.code = 'ResourceNotFoundException';
                throw error;
            };
            await invokeForSuccess(handler, eventOK);
        });

        it('should fail is something goes wrong with the cleaup API calls', async() => {
            // TODO use real mock (not override!)
            utils.deleteLambdaVersion = async() => {
                const error = new Error('very bad error');
                error.code = 'VeryBadError';
                throw error;
            };
            await invokeForFailure(handler, eventOK);
        });

    });

    describe('executor', () => {

        const handler = require('../lambda/executor').handler;

        var invokeLambdaCounter;

        beforeEach('mock utilities', () => {
            invokeLambdaCounter = 0;
            // TODO use real mock (not override!)
            utils.invokeLambda = async() => {
                invokeLambdaCounter++;
                // logs will always return 1ms duration with 128MB
                return {
                    StatusCode: 200,
                    LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMTAwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==',
                    ExecutedVersion: '$LATEST',
                    Payload: '{}' };
            };
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
                { lambdaARN: 'arnOK', value: null },
                { lambdaARN: 'arnOK', value: 0 },
                { lambdaARN: 'arnOK', value: 'invalid' },
                { lambdaARN: 'arnOK', value: 128 }, // 128 is ok
                { lambdaARN: 'arnOK', value: '128' }, // '128' is ok
                { lambdaARN: 'arnOK', value: 128, num: null },
                { lambdaARN: 'arnOK', value: 128, num: 0 },
                { lambdaARN: 'arnOK', value: 128, num: 'invalid' },
            ];

            invalidEvents.forEach(event => {
                expect(async() => {
                    await invokeForFailure(handler, event);
                }).to.not.throwError();
            });
        });

        it('should invoke the given cb, when done', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: '128',
                num: 10,
            });
        });

        it('should invoke the given cb, when done (parallelInvocation)', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: '128',
                num: 10,
                parallelInvocation: true,
            });
        });

        it('should return statistics', async() => {
            const response = await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: '128',
                num: 10,
            });

            expect(response).to.be.an('object');
            expect(response.averagePrice).to.be.a('number');
            expect(response.averageDuration).to.be.a('number');
            expect(response.totalCost).to.be.a('number');
            expect(response.totalCost).to.be(process.env.minCost * 10);
        });

        it('should invoke the given cb, when done (custom payload)', async() => {
            await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: '128',
                num: 10,
                payload: { key1: 'value1', key2: 'value2' },
            });
        });

        [1, 10, 100].forEach(num => {
            it('should invoke Lambda ' + num + ' time(s)', async() => {
                await invokeForSuccess(handler, {
                    lambdaARN: 'arnOK',
                    value: '128',
                    num: num,
                });
                expect(invokeLambdaCounter).to.be(num);
            });
            it('should invoke Lambda ' + num + ' time(s) in parallel', async() => {
                await invokeForSuccess(handler, {
                    lambdaARN: 'arnOK',
                    value: '128',
                    num: num,
                    parallelInvocation: true,
                });
                expect(invokeLambdaCounter).to.be(num);
            });
        });

        it('should report an error if invocation fails', async() => {
            utils.invokeLambda = async() => {
                return {
                    FunctionError: 'Unhandled',
                    Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
                };
            };
            await invokeForFailure(handler, {
                lambdaARN: 'arnOK',
                value: '1024',
                num: 10,
            });

        });

        it('should report an error if invocation fails (parallel)', async() => {
            utils.invokeLambda = async() => {
                return {
                    FunctionError: 'Unhandled',
                    Payload: '{"errorType": "MemoryError", "stackTrace": [["/var/task/lambda_function.py", 11, "lambda_handler", "blabla"], ["/var/task/lambda_function.py", 7, "blabla]]}',
                };
            };
            await invokeForFailure(handler, {
                lambdaARN: 'arnOK',
                value: '1024',
                num: 10,
                parallelInvocation: true,
            });

        });

        it('should return price as output', async() => {
            const stats = await invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: '128',
                num: 10,
            });
            expect(stats.averagePrice).to.be.a('number');
            expect(stats.averageDuration).to.be.a('number');
        });

    });

    describe('analyzer', () => {

        const handler = require('../lambda/analyzer').handler;

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

        const handler = require('../lambda/optimizer').handler;

        var setLambdaPowerCounter,
            publishLambdaVersionCounter,
            createLambdaAliasCounter,
            updateLambdaAliasCounter;

        beforeEach('mock utilities', () => {
            setLambdaPowerCounter = 0;
            publishLambdaVersionCounter = 0;
            createLambdaAliasCounter = 0;
            updateLambdaAliasCounter = 0;
            // TODO use real mock (not override!)
            utils.getLambdaAlias = async() => {
                const error = new Error('alias is not defined');
                error.code = 'ResourceNotFoundException';
                throw error;
            };
            utils.setLambdaPower = async() => {
                setLambdaPowerCounter++;
                return 'OK';
            };
            utils.publishLambdaVersion = async() => {
                publishLambdaVersionCounter++;
                return { Version: 1 };
            };
            utils.createLambdaAlias = async() => {
                createLambdaAliasCounter++;
                return 'OK';
            };
            utils.updateLambdaAlias = async() => {
                updateLambdaAliasCounter++;
                return 'OK';
            };
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
            utils.getLambdaAlias = async() => {
                return { FunctionVersion: '1' };
            };
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
