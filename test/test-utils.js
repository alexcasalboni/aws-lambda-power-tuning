'use strict';

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

describe('Lambda Utils', () => {

    // I'm dynamically generating tests for all these utilities
    const lambdaUtilities = [
        utils.checkLambdaAlias,
        utils.setLambdaPower,
        utils.publishLambdaVersion,
        utils.deleteLambdaVersion,
        utils.createLambdaAlias,
        utils.deleteLambdaAlias,
        utils.invokeLambda,
    ];

    // just returns the utility name for convenience
    function _fname(func) {
        const keys = Object.keys(utils);
        for (var i = 0; i < keys.length; i++) {
            var name = keys[i];
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

    describe('computeStats', () => {
        const minCost = 0.000000208; // $
        const minRAM = 128; // MB
        const value = 1024; // MB
        const averageDuration = 300; // ms

        it('should return the average price', () => {
            const stats = utils.computeStats(minCost, minRAM, value, averageDuration);
            expect(stats).to.be.an('object');
            expect(stats.averagePrice).to.be(minCost * 8 * 3);
            expect(stats.averageDuration).to.be(300);
        });
    });

    describe('computeAverageDuration', () => {
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

        it('should return the average price', () => {
            const duration = utils.computeAverageDuration(results);
            expect(duration).to.be(2);
        });
        it('should return 0 if empty results', () => {
            const duration = utils.computeAverageDuration([]);
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

});
