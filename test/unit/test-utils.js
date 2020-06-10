'use strict';

const expect = require('expect.js');

// const AWS = require('aws-sdk');
var AWS = require('aws-sdk-mock');

process.env.sfCosts = `{"us-gov-west-1": 0.00003,"eu-north-1": 0.000025,
"eu-central-1": 0.000025,"us-east-1": 0.000025,"ap-northeast-1": 0.000025,
"ap-northeast-2": 0.0000271,"eu-south-1": 0.00002625,"af-south-1": 0.00002975,
"us-west-1": 0.0000279,"eu-west-3": 0.0000297,"ap-southeast-2": 0.000025,
"ap-east-1": 0.0000275,"eu-west-2": 0.000025,"me-south-1": 0.0000275,
"us-east-2": 0.000025,"ap-south-1": 0.0000285,"ap-southeast-1": 0.000025,
"us-gov-east-1": 0.00003,"ca-central-1": 0.000025,"eu-west-1": 0.000025,
"us-west-2": 0.000025,"sa-east-1": 0.0000375}`;

process.env.AWS_REGION = 'af-south-1';

const utils = require('../../lambda/utils');

// AWS SDK mocks
AWS.mock('Lambda', 'getAlias', {});
AWS.mock('Lambda', 'getFunctionConfiguration', {MemorySize: 1024});
AWS.mock('Lambda', 'updateFunctionConfiguration', {});
AWS.mock('Lambda', 'publishVersion', {});
AWS.mock('Lambda', 'deleteFunction', {});
AWS.mock('Lambda', 'createAlias', {});
AWS.mock('Lambda', 'deleteAlias', {});
AWS.mock('Lambda', 'invoke', {});

describe('Lambda Utils', () => {

    // I'm dynamically generating tests for all these utilities
    const lambdaUtilities = [
        utils.getLambdaAlias,
        utils.setLambdaPower,
        utils.publishLambdaVersion,
        utils.deleteLambdaVersion,
        utils.createLambdaAlias,
        utils.updateLambdaAlias,
        utils.deleteLambdaAlias,
        utils.invokeLambda,
        utils.invokeLambdaWithProcessors,
    ];

    // TODO fix me (use proper mocking in test-lambda.js)
    const getLambdaPower = utils.getLambdaPower;
    const invokeLambdaProcessor = utils.invokeLambdaProcessor;

    // just returns the utility name for convenience
    function _fname(func) {
        const keys = Object.keys(utils);
        for (let name of keys) {
            if (utils[name] === func) {
                return name;
            }
        }
        throw new Error('Export not found! ' + func);
    }

    lambdaUtilities.forEach(func => {
        describe(_fname(func), () => {
            it('should return a promise', () => {
                const result = func('arn:aws:lambda:us-east-1:XXX:function:YYY', 'test', 'test');
                expect(result).to.be.a(Promise);
            });
            // TODO add more tests!
        });
    });

    describe('stepFunctionsCost', () => {
        it('should return expected step base cost', () => {
            process.env.sfCosts = '{"us-gov-west-1": 0.00003, "default": 0.000025}';
            process.env.AWS_REGION = 'us-gov-west-1';
            const result = utils.stepFunctionsBaseCost();
            expect(result).to.be.equal(0.00003);
        });
        it('should return default step base cost', () => {
            process.env.sfCosts = '{"us-gov-west-1": 0.00003, "default": 0.000025}';
            process.env.AWS_REGION = 'af-south-1';
            const result = utils.stepFunctionsBaseCost();
            expect(result).to.be.equal(0.000025);
        });
    });

    describe('stepFunctionsBaseCost', () => {
        it('should return expected step total cost', () => {
            process.env.sfCosts = '{"us-gov-west-1": 0.00003, "default": 0.000025}';
            process.env.AWS_REGION = 'us-gov-west-1';
            const nPower = 10;
            const expectedCost = +(0.00003 * (6 + nPower)).toFixed(5);
            const result = utils.stepFunctionsCost(nPower);
            expect(result).to.be.equal(expectedCost);
        });
    });

    describe('getLambdaPower', () => {
        it('should return the memory value', async() => {
            const value = await getLambdaPower('arn:aws:lambda:us-east-1:XXX:function:YYY');
            expect(value).to.be(1024);
        });
    });

    describe('verifyAliasExistance', () => {

        it('should return true if the alias exists', async() => {
            utils.getLambdaAlias = async() => {
                return { FunctionVersion: '1' };
            };
            const aliasExists = await utils.verifyAliasExistance('arnOK', 'aliasName');
            expect(aliasExists).to.be(true);
        });

        it('should return false if the alias does not exists', async() => {
            utils.getLambdaAlias = async() => {
                const error = new Error('alias is not defined');
                error.code = 'ResourceNotFoundException';
                throw error;
            };
            const aliasExists = await utils.verifyAliasExistance('arnOK', 'aliasName');
            expect(aliasExists).to.be(false);
        });
    });

    describe('extractDuration', () => {
        const log =
            'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n' +
            'END RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc\n' +
            'REPORT RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc\tDuration: 469.40 ms\tBilled Duration: 500 ms\tMemory Size: 1024 MB\tMax Memory Used: 21 MB'
            ;
        it('should extract the duration from a Lambda log', () => {
            expect(utils.extractDuration(log)).to.be(469.40);
        });
        it('should return 0 if duration is not found', () => {
            expect(utils.extractDuration('hello world')).to.be(0);
            const partialLog = 'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n';
            expect(utils.extractDuration(partialLog)).to.be(0);
        });
    });

    describe('computePrice', () => {
        const minCost = 0.000000208; // $
        const minRAM = 128; // MB
        const value = 1024; // MB
        const averageDuration = 300; // ms

        it('should return the average price', () => {
            const avgPrice = utils.computePrice(minCost, minRAM, value, averageDuration);
            expect(avgPrice).to.be.a('number');
            expect(avgPrice).to.be(minCost * 8 * 3);
        });
    });

    describe('parseLogAndExtractDurations', () => {
        const results = [
            // 1s (will be discarted)
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMTAwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==', Payload: 'null' },
            // 1s
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMTAwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==', Payload: 'null' },
            // 2s -> avg!
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMi4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMTAwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==', Payload: 'null' },
            // 3s
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMTAwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==', Payload: 'null' },
            // 3s (will be discarted)
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMTAwIG1zIAlNZW1vcnkgU2l6ZTogMTI4IE1CCU1heCBNZW1vcnkgVXNlZDogMTUgTUIJCg==', Payload: 'null' },
        ];

        it('should return the list of durations', () => {
            const durations = utils.parseLogAndExtractDurations(results);
            expect(durations).to.be.a('array');
            expect(durations.length).to.be(5);
            expect(durations).to.eql([1, 1, 2, 3, 3]);
        });
        it('should return empty list if empty results', () => {
            const durations = utils.parseLogAndExtractDurations([]);
            expect(durations).to.be.an('array');
            expect(durations.length).to.be(0);
        });

        it('should not explode if missing logs', () => {
            const durations = utils.parseLogAndExtractDurations([
                { StatusCode: 200, Payload: 'null' },
            ]);
            expect(durations).to.be.an('array');
            expect(durations).to.eql([0]);
        });
    });

    describe('computeAverageDuration', () => {
        const durations = [
            1, 1, 2, 3, 3,
        ];

        it('should return the average duration', () => {
            const duration = utils.computeAverageDuration(durations);
            expect(duration).to.be(2);
        });
        it('should return 0 if empty results', () => {
            const duration = utils.computeAverageDuration([]);
            expect(duration).to.be(0);
        });
    });

    describe('computeTotalCost', () => {
        const minCost = 0.000000208; // $
        const minRAM = 128; // MB
        const value = 1024; // MB
        const durations = [
            100, 200, 200, 300, 400,
        ];

        it('should return the total cost', () => {
            const duration = utils.computeTotalCost(minCost, minRAM, value, durations);
            expect(duration).to.be(minCost * 8 * (1 + 2 + 2 + 3 + 4));
        });
        it('should return 0 if empty durations', () => {
            const duration = utils.computeTotalCost(minCost, minRAM, value, []);
            expect(duration).to.be(0);
        });
    });

    describe('base64decode', () => {
        it('should convert a string to base64', () => {
            expect(utils.base64decode('aGVsbG8gd29ybGQ=')).to.be('hello world');
            expect(utils.base64decode('bG9yZW0gaXBzdW0=')).to.be('lorem ipsum');
        });
        it('should explode with non-string arguments', () => {
            expect(() => utils.base64decode(null)).to.throwError();
            expect(() => utils.base64decode(undefined)).to.throwError();
            expect(() => utils.base64decode(10)).to.throwError();
        });
    });

    describe('range', () => {
        it('should generate a list of size N', () => {
            expect(utils.range(1)).to.be.an('array');
            expect(utils.range(0)).to.have.length(0);
            expect(utils.range(5)).to.have.length(5);
            expect(utils.range(50)).to.have.length(50);
            expect(utils.range(500)).to.have.length(500);
        });
        it('should explode when called with invalid arguments', () => {
            [-1, -2, -Infinity, Infinity, null, undefined].forEach(val => {
                expect(() => utils.range(val)).to.throwError();
            });
        });
    });

    describe('lambdaClientFromARN', () => {
        it('should return the region name', () => {
            const arn = 'arn:aws:lambda:us-east-1:XXX:function:YYY';
            expect(utils.lambdaClientFromARN(arn).config.region).to.be('us-east-1');
        });

        [undefined, null, 0, 10, '', 'arn:aws', {}].forEach(arn => {
            it('should explode when called with "' + arn + '"', () => {
                expect(() => utils.lambdaClientFromARN(arn)).to.throwError();
            });
        });
    });

    describe('buildVisualizationURL', () => {
        it('should return the visualization URL based on stats', () => {
            const stats = [
                {power: 1, duration: 2, cost: 3},
                {power: 2, duration: 2, cost: 2},
                {power: 3, duration: 1, cost: 2},
            ];
            const prefix = 'https://prefix/';
            const URL = utils.buildVisualizationURL(stats, prefix);
            expect(URL).to.be.a('string');
            expect(URL).to.contain('prefix');
            expect(URL).to.contain('#');
            expect(URL).to.contain(';');
            expect(URL).to.contain('AQACAAMA'); // powers
            expect(URL).to.contain('AAAAQAAAAEAAAIA'); // times
            expect(URL).to.contain('AABAQAAAAEAAAABA'); // costs
        });
    });

    describe('allPowerValues', () => {

        it('should return a list of integers between 128 and 3008', () => {
            const values = utils.allPowerValues();
            expect(values).to.be.an('array');
            values.forEach((val) => {
                expect(val).to.be.a('number');
                expect(val).to.be.greaterThan(127);
                expect(val).to.be.lessThan(3009);
            });
        });

        it('should return a list of integers at intervals of 64', () => {
            const values = utils.allPowerValues();
            let val1, val2;
            for (let i = 0; i < values.length - 1; i++) {
                val1 = values[i];
                val2 = values[i + 1];
                expect(val2 - val1).to.be(64);
            }
        });
    });

    describe('baseCostForRegion', () => {
        const prices = {
            'ap-east-1': 0.0000002865,
            'af-south-1': 0.0000002763,
            'me-south-1': 0.0000002583,
            default: 0.0000002083,
        };

        it('should return ap-east-1 base price', () => {
            expect(utils.baseCostForRegion(prices, 'ap-east-1')).to.be(0.0000002865);
        });

        it('should return default base price', () => {
            expect(utils.baseCostForRegion(prices, 'eu-west-1')).to.be(0.0000002083);
        });
    });

    describe('invokeLambdaProcessor', () => {
        // TODO proper mocking

        var invokeLambdaCounter;
        beforeEach('mock API call', () => {
            invokeLambdaCounter = 0;
        });

        it('should invoke the processing function', async() => {
            utils.invokeLambda = async(_arn, _alias, payload) => {
                invokeLambdaCounter++;
                return {
                    Payload: '{"OK": "OK"}',
                };
            };
            const data = await invokeLambdaProcessor('arnOK', {});
            expect(invokeLambdaCounter).to.be(1);
            expect(data).to.be('{"OK": "OK"}');
        });

        it('should explode if processor fails', async() => {
            utils.invokeLambda = async(_arn, _alias, _payload) => {
                invokeLambdaCounter++;
                return {
                    Payload: '{"KO": "KO"}',
                    FunctionError: 'Unhandled',
                };
            };
            try {
                const data = await invokeLambdaProcessor('arnOK', {});
                expect(data).to.be(null);
            } catch (ex) {
                expect(ex.message.includes('failed with error')).to.be(true);
            }

            expect(invokeLambdaCounter).to.be(1);
        });
    });

});
