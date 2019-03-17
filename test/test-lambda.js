const expect = require('expect.js');

// const AWS = require('aws-sdk');
var AWS = require('aws-sdk-mock');
const utils = require('../lambda/utils');

// AWS SDK mocks
AWS.mock('Lambda', 'getAlias', {});
AWS.mock('Lambda', 'updateFunctionConfiguration', {});
AWS.mock('Lambda', 'publishVersion', {});
AWS.mock('Lambda', 'deleteFunction', {});
AWS.mock('Lambda', 'createAlias', {});
AWS.mock('Lambda', 'deleteAlias', {});
AWS.mock('Lambda', 'invoke', {});

// mock env variables and context
const powerValues = [128, 256, 512, 1024];
process.env.powerValues = powerValues.join(',');
process.env.minRAM = 128;
process.env.minCost = 2.08e-7;
const fakeContext = {};

const invokeForSuccess = function (handler, event) {
    var err, data;
    function _cb(error, result) {
        err = error;
        data = result;
    }
    return handler(event, fakeContext, _cb)
        .then(function () {
            // apparently null and undefined are not equal for expect.js
            // see https://github.com/Automattic/expect.js/issues/74
            if (typeof err === 'undefined') err = null;
            if (typeof data === 'undefined') data = null;
            expect(err).to.be(null);
            expect(data).to.not.be(null);
            return Promise.resolve(data);
        });
};
const invokeForFailure = function (handler, event) {
    var err, data;
    function _cb(error, result) {
        err = error;
        data = result;
    }
    return handler(event, fakeContext, _cb)
        .then(function () {
            // apparently null and undefined are not equal for expect.js
            // see https://github.com/Automattic/expect.js/issues/74
            if (typeof err === 'undefined') err = null;
            if (typeof data === 'undefined') data = null;
            expect(err).to.not.be(null);
            expect(data).to.be(null);
            return Promise.resolve(err);
        });
};

describe('Lambda Functions', function () {

    describe('initializer', function () {

        const handler = require('../lambda/initializer').handler;

        var setLambdaPowerCounter,
            publishLambdaVersionCounter,
            createLambdaAliasCounter;

        beforeEach('mock utilities', function () {
            setLambdaPowerCounter = 0;
            publishLambdaVersionCounter = 0;
            createLambdaAliasCounter = 0;
            // TODO use real mock (not override!)
            utils.checkLambdaAlias = function () {
                return Promise.reject(new Error('alias is not defined'));
            };
            utils.setLambdaPower = function () {
                setLambdaPowerCounter++;
                return Promise.resolve('OK');
            };
            utils.publishLambdaVersion = function () {
                publishLambdaVersionCounter++;
                return Promise.resolve({ Version: 1 });
            };
            utils.createLambdaAlias = function () {
                createLambdaAliasCounter++;
                return Promise.resolve('OK');
            };
        });

        it('should explode if invoked without a lambdaARN', function () {
            const invalidEvents = [
                null,
                {},
                { lambdaARN: null },
                { lambdaARN: '' },
                { lambdaARN: false },
                { lambdaARN: 0 },
            ];
            invalidEvents.forEach(function (event) {
                expect(function () {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });

            expect(function () {
                invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
            }).to.not.throwError();

        });

        it('should invoke the given cb, when done', function () {
            return invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
        });

        it('should create N aliases and verions', function () {
            return invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 })
                .then(function () {
                    expect(setLambdaPowerCounter).to.be(powerValues.length);
                    expect(publishLambdaVersionCounter).to.be(powerValues.length);
                    expect(createLambdaAliasCounter).to.be(powerValues.length);
                });
        });

        it('should work fine if an alias already exists', function () {
            // TODO use real mock (not override!)
            utils.checkLambdaAlias = function () {
                return Promise.resolve({ FunctionVersion: '1' });
            };
            return invokeForSuccess(handler, { lambdaARN: 'arnOK', num: 5 });
        });

        it('should explode if something goes wrong during power set', function () {
            // TODO use real mock (not override!)
            utils.setLambdaPower = function () {
                return Promise.reject(new Error("Something went wrong"));
            };
            return invokeForFailure(handler, { lambdaARN: 'arnOK', num: 5 });
        });

    });

    describe('cleaner', function () {

        const handler = require('../lambda/cleaner').handler;

        it('should explode if invoked without a lambdaARN', function () {
            const invalidEvents = [
                null,
                {},
                { lambdaARN: null },
                { lambdaARN: '' },
                { lambdaARN: false },
                { lambdaARN: 0 },
            ];
            invalidEvents.forEach(function (event) {
                expect(function () {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });
        });

        beforeEach('mock utilities', function () {
            // TODO use real mock (not override!)
            utils.checkLambdaAlias = function () {
                return Promise.resolve({ FunctionVersion: '1' });
            };
            utils.deleteLambdaAlias = function () {
                return Promise.resolve('OK');
            };
            utils.deleteLambdaVersion = function () {
                return Promise.resolve('OK');
            };
        });

        it('should invoke the given cb, when done', function () {
            return invokeForSuccess(handler, { lambdaARN: 'arnOK' });
        });

        it('should work fine even if the version does not exist', function () {
            // TODO use real mock (not override!)
            utils.deleteLambdaVersion = function () {
                return Promise.reject(new Error('version is not defined'));
            };
            return invokeForSuccess(handler, { lambdaARN: 'arnOK' });
        });

        it('should work fine even if the alias does not exist', function () {
            // TODO use real mock (not override!)
            utils.deleteLambdaAlias = function () {
                return Promise.reject(new Error('alias is not defined'));
            };
            return invokeForSuccess(handler, { lambdaARN: 'arnOK' });
        });


    });

    describe('executor', function () {

        const handler = require('../lambda/executor').handler;

        var invokeLambdaCounter;

        beforeEach('mock utilities', function () {
            invokeLambdaCounter = 0;
            // TODO use real mock (not override!)
            utils.invokeLambda = function () {
                invokeLambdaCounter++;
                return Promise.resolve('OK');
            };
        });

        it('should explode if invoked with invalid input', function () {
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
                { lambdaARN: 'arnOK', value: 128 },  // 128 is ok
                { lambdaARN: 'arnOK', value: '128' },  // '128' is ok
                { lambdaARN: 'arnOK', value: 128, num: null },
                { lambdaARN: 'arnOK', value: 128, num: 0 },
                { lambdaARN: 'arnOK', value: 128, num: 'invalid' },
            ];

            invalidEvents.forEach(function (event) {
                expect(function () {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });
        });

        it('should invoke the given cb, when done', function () {
            return invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: 128,
                num: 10,
            });
        });

        it('should invoke the given cb, when done (parallelInvocation)', function () {
            return invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: 128,
                num: 10,
                parallelInvocation: true
            });
        });

        it('should invoke the given cb, when done (custom payload)', function () {
            return invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: 128,
                num: 10,
                payload: { key1: 'value1', key2: 'value2' },
            });
        });

        [1, 10, 100].forEach(function (num) {
            it('should invoke Lambda ' + num + ' time(s)', function () {
                return invokeForSuccess(handler, {
                    lambdaARN: 'arnOK',
                    value: 128,
                    num: num,
                }).then(function () {
                    expect(invokeLambdaCounter).to.be(num);
                });
            });
            it('should invoke Lambda ' + num + ' time(s) in parallel', function () {
                return invokeForSuccess(handler, {
                    lambdaARN: 'arnOK',
                    value: 128,
                    num: num,
                    parallelInvocation: true,
                }).then(function () {
                    expect(invokeLambdaCounter).to.be(num);
                });
            });
        });

        it('should return price as output', function () {
            return invokeForSuccess(handler, {
                lambdaARN: 'arnOK',
                value: 128,
                num: 10,
            }).then(function (stats) {
                expect(stats.averagePrice).to.be.a('number');
                expect(stats.averageDuration).to.be.a('number');

            });
        });

    });

    describe('finalizer', function () {

        const handler = require('../lambda/finalizer').handler;

        it('should explode if invoked without invalid event', function () {
            const invalidEvents = [
                null,
                {},
                [],
                { lambdaARN: '' },
                { whatever: 1 }
            ];
            invalidEvents.forEach(function (event) {
                expect(function () {
                    invokeForFailure(handler, event);
                }).to.throwError();
            });
        });

        it('should return the cheapest power configuration', function () {
            const event = [
                { 'value': '128', 'stats': { 'averagePrice': 100, 'averageDuration': 100 } },
                { 'value': '256', 'stats': { 'averagePrice': 200, 'averageDuration': 300 } },
                { 'value': '512', 'stats': { 'averagePrice': 30, 'averageDuration': 200 } },
            ];

            return invokeForSuccess(handler, event)
                .then(function (result) {
                    expect(result).to.be.an('object');
                    expect(result.power).to.be('512');
                    expect(result.cost).to.be(30);
                    expect(result.duration).to.be(200);
                });

        });

    });

});