'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

var awsV3Mock = require('aws-sdk-client-mock');
const {
    CreateAliasCommand, DeleteAliasCommand, DeleteFunctionCommand, GetAliasCommand,
    GetFunctionConfigurationCommand, InvokeCommand, LambdaClient, PublishVersionCommand,
    UpdateFunctionConfigurationCommand, UpdateAliasCommand, ResourceNotFoundException,
} = require('@aws-sdk/client-lambda');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

process.env.sfCosts = `{"us-gov-west-1": 0.00003,"eu-north-1": 0.000025,
"eu-central-1": 0.000025,"us-east-1": 0.000025,"ap-northeast-1": 0.000025,
"ap-northeast-2": 0.0000271,"eu-south-1": 0.00002625,"af-south-1": 0.00002975,
"us-west-1": 0.0000279,"eu-west-3": 0.0000297,"ap-southeast-2": 0.000025,
"ap-east-1": 0.0000275,"eu-west-2": 0.000025,"me-south-1": 0.0000275,
"us-east-2": 0.000025,"ap-south-1": 0.0000285,"ap-southeast-1": 0.000025,
"us-gov-east-1": 0.00003,"ca-central-1": 0.000025,"eu-west-1": 0.000025,
"us-west-2": 0.000025,"sa-east-1": 0.0000375}`;
process.env.baseCosts = '{"x86_64": {"ap-east-1":2.9e-9,"af-south-1":2.8e-9,"me-south-1":2.6e-9,"eu-south-1":2.4e-9,"default":2.1e-9}, "arm64": {"default":1.7e-9}}';


process.env.AWS_REGION = 'af-south-1';

const utils = require('../../lambda/utils');
const { consoleLogStub: consoleLogSetupStub } = require('../setup.spec');

const sandBox = sinon.createSandbox();

// AWS SDK mocks
const lambdaMock = awsV3Mock.mockClient(LambdaClient);
lambdaMock.reset();
lambdaMock.on(GetAliasCommand).resolves({});
lambdaMock.on(GetFunctionConfigurationCommand).resolves({
    MemorySize: 1024,
    State: 'Active',
    LastUpdateStatus: 'Successful',
    Architectures: ['x86_64'],
    Description: 'Sample Description',
});
lambdaMock.on(UpdateFunctionConfigurationCommand).resolves({});
lambdaMock.on(PublishVersionCommand).resolves({});
lambdaMock.on(DeleteFunctionCommand).resolves({});
lambdaMock.on(CreateAliasCommand).resolves({});
lambdaMock.on(DeleteAliasCommand).resolves({});
lambdaMock.on(InvokeCommand).resolves({});
lambdaMock.on(UpdateAliasCommand).resolves({});
const s3Mock = awsV3Mock.mockClient(S3Client);
s3Mock.reset();
s3Mock.on(GetObjectCommand).resolves({
    Body: {
        transformToString: async(encoding) => {
            return '{"Value": "OK"}';
        },
    },
});

// utility to create a UInt8Array from a string
const toByteArray = (inputString) => {
    const textEncoder = new TextEncoder();
    return textEncoder.encode(inputString);
};


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
        utils.waitForFunctionUpdate,
    ];

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

    // this is mainly for coverage (it's not doing much, just making sure the code runs)
    lambdaUtilities.forEach(func => {
        describe(_fname(func), () => {
            it('should return a promise', () => {
                const result = func('arn:aws:lambda:us-east-1:XXX:function:YYY', 'test', 'test');
                expect(result).to.be.an('object');
            });
            // TODO add more tests!
        });
    });

    afterEach('Global mock utilities afterEach', () => {
        // restore everything to its natural order
        sandBox.restore();
    });

    describe('stepFunctionsBaseCost', () => {
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

    describe('stepFunctionsCost', () => {
        it('should return expected step total cost', () => {
            process.env.sfCosts = '{"us-gov-west-1": 0.00003, "default": 0.000025}';
            process.env.AWS_REGION = 'us-gov-west-1';
            const nPower = 10;
            const expectedCost = 0.00108;
            const result = utils.stepFunctionsCost(nPower, false, 10);
            expect(result).to.be.equal(expectedCost);
        });
        it('should return expected step total cost when onlyColdStarts=true', () => {
            process.env.sfCosts = '{"us-gov-west-1": 0.00003, "default": 0.000025}';
            process.env.AWS_REGION = 'us-gov-west-1';
            const nPower = 10;
            const expectedCost = 0.00648;
            const result = utils.stepFunctionsCost(nPower, true, 10);
            expect(result).to.be.equal(expectedCost);
        });
    });

    describe('getLambdaPower', () => {
        it('should return the power value and description', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({
                MemorySize: 1024,
                State: 'Active',
                LastUpdateStatus: 'Successful',
                Architectures: ['x86_64'],
                Description: 'Sample Description', // this is null if no vars are set
            });
            const value = await utils.getLambdaPower('arn:aws:lambda:us-east-1:XXX:function:YYY');
            expect(value.power).to.be(1024);
            expect(value.description).to.be('Sample Description');
        });

        it('should return the power value and description, even if empty', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({
                MemorySize: 1024,
                State: 'Active',
                LastUpdateStatus: 'Successful',
                Architectures: ['x86_64'],
                Description: '', // this is null if no vars are set
            });

            const value = await utils.getLambdaPower('arn:aws:lambda:us-east-1:XXX:function:YYY');
            expect(value.power).to.be(1024);
            expect(value.description).to.be('');
        });
    });

    describe('verifyAliasExistance', () => {

        it('should return true if the alias exists', async() => {
            sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    return { FunctionVersion: '1' };
                });
            const aliasExists = await utils.verifyAliasExistance('arnOK', 'aliasName');
            expect(aliasExists).to.be(true);
        });

        it('should return false if the alias does not exists', async() => {
            sandBox.stub(utils, 'getLambdaAlias')
                .callsFake(async() => {
                    const error = new ResourceNotFoundException('alias is not defined');
                    throw error;
                });
            const aliasExists = await utils.verifyAliasExistance('arnOK', 'aliasName');
            expect(aliasExists).to.be(false);
        });
    });

    describe('waitForFunctionUpdate', () => {

        it('should return if LastUpdateStatus is successful', async() => {
            // TODO: remove waitFor mock and test this properly
            await utils.waitForFunctionUpdate('arn:aws:lambda:us-east-1:XXX:function:YYY');
        });

    });

    describe('waitForAliasActive', () => {

        it('should return if Status is Active', async() => {
            // TODO: remove waitFor mock and test this properly
            await utils.waitForAliasActive('arn:aws:lambda:us-east-1:XXX:function:YYY', 'aliasName');
        });

    });

    const textLog =
        'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n' +
        'END RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc\n' +
        'REPORT RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc\tDuration: 469.40 ms\tBilled Duration: 500 ms\tMemory Size: 1024 MB\tMax Memory Used: 21 MB\tInit Duration: 100.99 ms'
        ;
    const textLogSnapStart =
        'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n' +
        'END RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc\n' +
        'REPORT RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc\tDuration: 469.40 ms\tBilled Duration: 500 ms\tMemory Size: 1024 MB\tMax Memory Used: 21 MB\tRestore Duration: 474.16 ms\tBilled Restore Duration: 75 ms'
        ;

    // JSON logs contain multiple objects, seperated by a newline
    const jsonLog =
        '{"timestamp":"2024-02-09T08:42:44.078Z","level":"INFO","requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","message":"Just some logs here =)"}\n' +
        '{"time":"2024-02-09T08:42:44.078Z","type":"platform.start","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","version":"8"}}\n' +
        '{"time":"2024-02-09T08:42:44.079Z","type":"platform.runtimeDone","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","spans":[{"name":"responseLatency","start":"2024-02-09T08:42:44.078Z","durationMs":0.677},{"name":"responseDuration","start":"2024-02-09T08:42:44.079Z","durationMs":0.035},{"name":"runtimeOverhead","start":"2024-02-09T08:42:44.079Z","durationMs":0.211}],"metrics":{"durationMs":1.056,"producedBytes":50}}}\n' +
        '{"time":"2024-02-09T08:42:44.080Z","type":"platform.report","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","metrics":{"durationMs":1.317,"billedDurationMs":2,"memorySizeMB":1024,"maxMemoryUsedMB":68,"initDurationMs": 10}}}'
        ;

    const jsonLogSnapStart =
        '{"timestamp":"2024-02-09T08:42:44.078Z","level":"INFO","requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","message":"Just some logs here =)"}\n' +
        '{"time":"2024-02-09T08:42:44.078Z","type":"platform.start","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","version":"8"}}\n' +
        '{"time":"2024-02-09T08:42:44.079Z","type":"platform.runtimeDone","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","spans":[{"name":"responseLatency","start":"2024-02-09T08:42:44.078Z","durationMs":0.677},{"name":"responseDuration","start":"2024-02-09T08:42:44.079Z","durationMs":0.035},{"name":"runtimeOverhead","start":"2024-02-09T08:42:44.079Z","durationMs":0.211}],"metrics":{"durationMs":1.056,"producedBytes":50}}}\n' +
        '{"time":"2024-02-09T08:42:44.080Z","type":"platform.report","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","metrics":{"durationMs": 147.156,"billedDurationMs": 201, "memorySizeMB": 512,"maxMemoryUsedMB": 91,"restoreDurationMs": 500.795,"billedRestoreDurationMs": 53 }}}'
        ;

    const jsonMixedLog =
        '{"timestamp":"2024-02-09T08:42:44.078Z","level":"INFO","requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","message":"Just some logs here =)"}\n' +
        '[AWS Parameters and Secrets Lambda Extension] 2024/04/11 02:14:17 PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL is info. Log level set to info.' +
        '{"time":"2024-02-09T08:42:44.078Z","type":"platform.start","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","version":"8"}}\n' +
        '{"time":"2024-02-09T08:42:44.079Z","type":"platform.runtimeDone","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","spans":[{"name":"responseLatency","start":"2024-02-09T08:42:44.078Z","durationMs":0.677},{"name":"responseDuration","start":"2024-02-09T08:42:44.079Z","durationMs":0.035},{"name":"runtimeOverhead","start":"2024-02-09T08:42:44.079Z","durationMs":0.211}],"metrics":{"durationMs":1.056,"producedBytes":50}}}\n' +
        '{"time":"2024-02-09T08:42:44.080Z","type":"platform.report","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","metrics":{"durationMs":1.317,"billedDurationMs":4,"memorySizeMB":1024,"maxMemoryUsedMB":68,"initDurationMs": 20}}}'
        ;

    const jsonMixedLogWithInvalidJSON =
        '{"timestamp":"2024-02-09T08:42:44.078Z","level":"INFO","requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","message":"Just some logs here =)"\n' + // missing } here
        '[AWS Parameters and Secrets Lambda Extension] 2024/04/11 02:14:17 PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL is info. Log level set to info.' +
        '{"time":"2024-02-09T08:42:44.078Z","type":"platform.start","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","version":"8"}}\n' +
        '{"time":"2024-02-09T08:42:44.079Z","type":"platform.runtimeDone","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","spans":[{"name":"responseLatency","start":"2024-02-09T08:42:44.078Z","durationMs":0.677},{"name":"responseDuration","start":"2024-02-09T08:42:44.079Z","durationMs":0.035},{"name":"runtimeOverhead","start":"2024-02-09T08:42:44.079Z","durationMs":0.211}],"metrics":{"durationMs":1.056,"producedBytes":50}}}\n' +
        '{"time":"2024-02-09T08:42:44.080Z","type":"platform.report","record":{"requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","status":"success","metrics":{"durationMs":1.317,"billedDurationMs":8,"memorySizeMB":1024,"maxMemoryUsedMB":68,"initDurationMs": 30}}}'
        ;

    const invalidJSONLog = '{"timestamp":"2024-02-09T08:42:44.078Z","level":"INFO","requestId":"d661f7cf-9208-46b9-85b0-213b04a91065","message":"Just some logs here =)"}';

    describe('extractDuration', () => {

        it('should extract the duration from a Lambda log (text format)', () => {
            expect(utils.extractDuration(textLog)).to.be(469.4);
        });

        it('should retrieve the Init Duration from a Lambda log (text format)', () => {
            expect(utils.extractDuration(textLog, utils.DURATIONS.initDurationMs)).to.be(100.99);
        });

        it('should retrieve the Billed Duration from a Lambda log (text format)', () => {
            expect(utils.extractDuration(textLog, utils.DURATIONS.billedDurationMs)).to.be(500);
        });

        it('should retrieve the Restore Duration from a SnapStart Lambda log (text format)', () => {
            expect(utils.extractDuration(textLogSnapStart, utils.DURATIONS.restoreDurationMs)).to.be(474.16);
        });
        it('should retrieve the Billed Restore Duration from a SnapStart Lambda log (text format)', () => {
            expect(utils.extractDuration(textLogSnapStart, utils.DURATIONS.billedRestoreDurationMs)).to.be(75);
        });

        it('should return 0 if duration is not found', () => {
            expect(utils.extractDuration('hello world')).to.be(0);
            const partialLog = 'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n';
            expect(utils.extractDuration(partialLog)).to.be(0);
        });

        it('should return 0 if Init Duration is not found', () => {
            expect(utils.extractDuration('hello world', utils.DURATIONS.initDurationMs)).to.be(0);
            const partialLog = 'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n';
            expect(utils.extractDuration(partialLog, utils.DURATIONS.initDurationMs)).to.be(0);
        });

        it('should return 0 if Restore Duration is not found', () => {
            expect(utils.extractDuration('hello world', utils.DURATIONS.restoreDurationMs)).to.be(0);
            const partialLog = 'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n';
            expect(utils.extractDuration(partialLog, utils.DURATIONS.restoreDurationMs)).to.be(0);
        });

        it('should return 0 if Billed Duration is not found', () => {
            expect(utils.extractDuration('hello world', utils.DURATIONS.billedDurationMs)).to.be(0);
            const partialLog = 'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n';
            expect(utils.extractDuration(partialLog, utils.DURATIONS.billedDurationMs)).to.be(0);
        });

        it('should return 0 if Billed Restore Duration is not found', () => {
            expect(utils.extractDuration('hello world', utils.DURATIONS.billedRestoreDurationMs)).to.be(0);
            const partialLog = 'START RequestId: 55bc566d-1e2c-11e7-93e6-6705ceb4c1cc Version: $LATEST\n';
            expect(utils.extractDuration(partialLog, utils.DURATIONS.billedRestoreDurationMs)).to.be(0);
        });

        it('should extract the duration from a Lambda log (json format)', () => {
            expect(utils.extractDuration(jsonLog, utils.DURATIONS.durationMs)).to.be(1.317);
        });

        it('should extract the Init duration from a Lambda log (json format)', () => {
            expect(utils.extractDuration(jsonLog, utils.DURATIONS.initDurationMs)).to.be(10);
        });

        it('should extract the Restore duration from a Lambda log (json format)', () => {
            expect(utils.extractDuration(jsonLogSnapStart, utils.DURATIONS.restoreDurationMs)).to.be(500.795);
        });

        it('should extract the Billed Restore duration from a Lambda log (json format)', () => {
            expect(utils.extractDuration(jsonLogSnapStart, utils.DURATIONS.billedRestoreDurationMs)).to.be(53);
        });

        it('should extract the duration from a Lambda log (json text mixed format)', () => {
            expect(utils.extractDuration(jsonMixedLog)).to.be(1.317);
        });

        it('should extract the duration from a Lambda log (json text mixed format with invalid JSON)', () => {
            expect(utils.extractDuration(jsonMixedLogWithInvalidJSON)).to.be(1.317);
        });

        it('should explode if invalid json format document is provided', () => {
            expect(() => utils.extractDuration(invalidJSONLog)).to.throwError();
        });

    });

    describe('computePrice', () => {
        const minCost = 2.1e-9; // $ per ms
        const minRAM = 128; // MB
        const value = 1024; // MB
        const averageDuration = 300; // ms

        it('should return the average price', () => {
            const avgPrice = utils.computePrice(minCost, minRAM, value, averageDuration);
            expect(avgPrice).to.be.a('number');
            expect(avgPrice).to.be(minCost * (value / minRAM) * averageDuration);
        });
    });

    describe('parseLogAndExtractDurations', () => {
        const results = [
            // Duration 1ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Duration 1ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Duration 2ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMi4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMiBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Duration 3ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMyBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Duration 3ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMyBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
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

        it('should give duration as initDuration + duration', () => {
            const resultWithInitDuration =
              {
                  StatusCode: 200,
                  // Duration: 469.40 ms Init Duration: 100.99 ms
                  LogResult: Buffer.from(textLog).toString('base64'),
              };
            const durations = utils.parseLogAndExtractDurations([resultWithInitDuration]);
            expect(durations).to.be.a('array');
            expect(durations.length).to.be(1);
            expect(durations).to.eql([570.39]);
        });

        it('should give duration as restoreDuration + duration (for SnapStart)', () => {
            const resultWithInitDuration =
              {
                  StatusCode: 200,
                  // Duration: 469.40 ms - Restore Duration: 474.16 ms
                  LogResult: Buffer.from(textLogSnapStart).toString('base64'),
              };
            const durations = utils.parseLogAndExtractDurations([resultWithInitDuration]);
            expect(durations).to.be.a('array');
            expect(durations.length).to.be(1);
            expect(durations).to.eql([943.56]);
        });
    });
    describe('parseLogAndExtractBilledDurations', () => {
        const results = [
            // Billed Duration 1ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Billed Duration 1ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMS4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMSBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Billed Duration 2ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMi4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMiBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Billed Duration 3ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMyBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
            // Billed Duration 3ms
            { StatusCode: 200, LogResult: 'U1RBUlQgUmVxdWVzdElkOiA0NzlmYjUxYy0xZTM4LTExZTctOTljYS02N2JmMTYzNjA4ZWQgVmVyc2lvbjogOTkKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTEgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTIgPSB1bmRlZmluZWQKMjAxNy0wNC0xMFQyMTo1NDozMi42ODNaCTQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAl2YWx1ZTMgPSB1bmRlZmluZWQKRU5EIFJlcXVlc3RJZDogNDc5ZmI1MWMtMWUzOC0xMWU3LTk5Y2EtNjdiZjE2MzYwOGVkClJFUE9SVCBSZXF1ZXN0SWQ6IDQ3OWZiNTFjLTFlMzgtMTFlNy05OWNhLTY3YmYxNjM2MDhlZAlEdXJhdGlvbjogMy4wIG1zCUJpbGxlZCBEdXJhdGlvbjogMyBtcyAJTWVtb3J5IFNpemU6IDEyOCBNQglNYXggTWVtb3J5IFVzZWQ6IDE1IE1C', Payload: 'null' },
        ];

        it('should return the list of billed durations', () => {
            const durations = utils.parseLogAndExtractBilledDurations(results);
            expect(durations).to.be.a('array');
            expect(durations.length).to.be(5);
            expect(durations).to.eql([1, 1, 2, 3, 3]);
        });
        it('should return empty list if empty results', () => {
            const durations = utils.parseLogAndExtractBilledDurations([]);
            expect(durations).to.be.an('array');
            expect(durations.length).to.be(0);
        });

        it('should not explode if missing logs', () => {
            const durations = utils.parseLogAndExtractBilledDurations([
                { StatusCode: 200, Payload: 'null' },
            ]);
            expect(durations).to.be.an('array');
            expect(durations).to.eql([0]);
        });


        it('should give duration as billedDuration + restoreDuration (for SnapStart)', () => {
            const resultWithInitDuration =
              {
                  StatusCode: 200,
                  // Billed Duration: 500 ms Billed Restore Duration: 75 ms
                  LogResult: Buffer.from(textLogSnapStart).toString('base64'),
              };
            const durations = utils.parseLogAndExtractBilledDurations([resultWithInitDuration]);
            expect(durations).to.be.a('array');
            expect(durations.length).to.be(1);
            expect(durations).to.eql([575]);
        });
    });

    describe('computeAverageDuration', () => {
        const durations = [
            // keep 5 values because it's the minimum length
            // `num` can't be smaller than 5, unless it's a dryrun
            1, 2, 3, 4, 2000,
        ];

        it('should return the average duration', () => {
            const duration = utils.computeAverageDuration(durations, 0.2);
            expect(duration).to.be(3);
        });

        it('should return the average duration custom trimming', () => {
            const duration = utils.computeAverageDuration(durations, 0.4);
            expect(duration).to.be(3);
        });
        it('should return the average duration with no trimmed value', () => {
            const duration = utils.computeAverageDuration(durations, 0);
            expect(duration).to.be(402);
        });
        it('should return the average duration even if not enough results to discard', () => {
            const duration = utils.computeAverageDuration([1], 0.4);
            expect(duration).to.be(1);
        });
        it('should return 0 if empty results', () => {
            const duration = utils.computeAverageDuration([], 0.2);
            expect(duration).to.be(0);
        });
    });

    describe('computeTotalCost', () => {
        const minCost = 2.1e-9; // $ per ms
        const minRAM = 128; // MB
        const value = 1024; // MB
        const durations = [
            100, 150, 200, 300, 400,
        ];

        // sum all
        const totDuration = durations.reduce((a, b) => a + b, 0);


        it('should return the total cost', () => {
            const duration = utils.computeTotalCost(minCost, minRAM, value, durations);
            expect(duration).to.be(minCost * (value / minRAM) * totDuration);
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
            expect(utils.regionFromARN(arn)).to.be('us-east-1');
        });

        [undefined, null, 0, 10, '', 'arn:aws', {}].forEach(arn => {
            it('should explode when called with "' + arn + '"', () => {
                expect(() => utils.lambdaClientFromARN(arn)).to.throwError();
            });
        });
    });

    describe('buildVisualizationURL', () => {
        const stats = [
            { power: 1, duration: 2, cost: 3 },
            { power: 2, duration: 2, cost: 2 },
            { power: 3, duration: 1, cost: 2 },
        ];
        const prefix = 'https://prefix/';

        it('should return the visualization URL based on stats', () => {
            const URL = utils.buildVisualizationURL(stats, prefix);
            expect(URL).to.be.a('string');
            expect(URL).to.contain('prefix');
            expect(URL).to.contain('#');
            expect(URL).to.contain(';');
            expect(URL).to.contain('AQACAAMA'); // powers
            expect(URL).to.contain('AAAAQAAAAEAAAIA'); // times
            expect(URL).to.contain('AABAQAAAAEAAAABA'); // costs
        });
        it('should include the CNY currency if region is cn-north-1', () => {
            process.env.AWS_REGION = 'cn-north-1';
            const URL = utils.buildVisualizationURL(stats, prefix);
            expect(URL).to.contain('?currency=CNY');
        });
        it('should include the CNY currency if region is cn-north-1', () => {
            process.env.AWS_REGION = 'cn-northwest-1';
            const URL = utils.buildVisualizationURL(stats, prefix);
            expect(URL).to.contain('?currency=CNY');
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

    describe('lambdaBaseCost', () => {
        it('should return x86 base prices', () => {
            expect(utils.lambdaBaseCost('eu-west-1', 'x86_64')).to.be(2.1e-9);
        });

        it('should return default base price', () => {
            expect(utils.lambdaBaseCost('eu-west-1', 'arm64')).to.be(1.7e-9);
        });

        it('should explode if invalid architecture', () => {
            expect(() => utils.lambdaBaseCost('eu-west-1', 'invalid_arch')).to.throwError();
        });
    });

    describe('getLambdaConfig', () => {

        it('should return a string representing the arch type', async() => {
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const alias = 'aliasName';
            const { architecture } = await utils.getLambdaConfig(ARN, alias);
            expect(architecture).to.be('x86_64');
        });

        it('should return arm64 when Graviton is supported', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({ MemorySize: 1024, State: 'Active', LastUpdateStatus: 'Successful', Architectures: ['arm64'] });
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const alias = 'aliasName';
            const { architecture } = await utils.getLambdaConfig(ARN, alias);
            expect(architecture).to.be('arm64');
        });

        it('should always return x86_64 when Graviton is not supported', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({ MemorySize: 1024, State: 'Active', LastUpdateStatus: 'Successful' });
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const alias = 'aliasName';
            const { architecture } = await utils.getLambdaConfig(ARN, alias);
            expect(architecture).to.be('x86_64');
        });

        it('should return isPending true when function/alias state is Pending', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({ MemorySize: 1024, State: 'Pending', LastUpdateStatus: 'Successful' });
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const alias = 'aliasName';
            const { isPending } = await utils.getLambdaConfig(ARN, alias);
            expect(isPending).to.be(true);
        });

        it('should return isPending false when function/alias state is not Pending', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({ MemorySize: 1024, State: 'Active', LastUpdateStatus: 'Successful' });
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const alias = 'aliasName';
            const { isPending } = await utils.getLambdaConfig(ARN, alias);
            expect(isPending).to.be(false);
        });

        it('should return isPending false when function/alias state is missing', async() => {
            lambdaMock.on(GetFunctionConfigurationCommand).resolves({ MemorySize: 1024, LastUpdateStatus: 'Successful' });
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const alias = 'aliasName';
            const { isPending } = await utils.getLambdaConfig(ARN, alias);
            expect(isPending).to.be(false);
        });
    });

    describe('invokeLambdaProcessor', () => {

        var invokeLambdaCounter;
        beforeEach('mock API call', () => {
            invokeLambdaCounter = 0;
        });

        it('should invoke the processing function without an alias', async() => {
            const ARN = 'arn:aws:lambda:eu-west-1:XXX:function:name';
            const data = await utils.invokeLambdaProcessor(ARN, '{}');
            expect(data).to.be(undefined); // mocked API call
        });

        it('should invoke the processing function', async() => {
            sandBox.stub(utils, 'invokeLambda')
                .callsFake(async() => {
                    invokeLambdaCounter++;
                    return {
                        Payload: '{"OK": "OK"}',
                    };
                });
            const data = await utils.invokeLambdaProcessor('arnOK', {});
            expect(invokeLambdaCounter).to.be(1);
            expect(data).to.be('{"OK": "OK"}');
        });

        const invokeLambdaProcessorReturningUnhandledError = async({ disablePayloadLogs, isPayloadInErrorMessage }) => {
            const payload = { keyOne: 'value-one' };
            sandBox.stub(utils, 'invokeLambda')
                .callsFake(async() => {
                    invokeLambdaCounter++;
                    return {
                        Payload: toByteArray('{"errorMessage": "Exception raised during execution.", ' +
                            '"errorType": "Exception", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ' +
                            '"stackTrace": ["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]}'),
                        FunctionError: 'Unhandled',
                    };
                });
            try {
                const data = await utils.invokeLambdaProcessor('arnOK', payload, 'Pre', disablePayloadLogs);
                expect(data).to.be(null);
            } catch (ex) {
                expect(ex.message).to.contain('failed');
                expect(ex.message.includes('with payload')).to.be(isPayloadInErrorMessage);
            }

            expect(invokeLambdaCounter).to.be(1);
        };

        it('should explode if processor fails and share payload in error when disablePayloadLogs is undefined', async() => invokeLambdaProcessorReturningUnhandledError({
            disablePayloadLogs: undefined,
            isPayloadInErrorMessage: true,
        }));
        it('should explode if processor fails and share payload in error when disablePayloadLogs is false', async() => invokeLambdaProcessorReturningUnhandledError({
            disablePayloadLogs: false,
            isPayloadInErrorMessage: true,
        }));
        it('should explode if processor fails and not share payload in error when disablePayloadLogs is true', async() => invokeLambdaProcessorReturningUnhandledError({
            disablePayloadLogs: true,
            isPayloadInErrorMessage: false,
        }));
    });

    const isJsonString = (str) => {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    };

    describe('handleLambdaInvocationError', () => {

        const invokeLambdaForInvocationErrorAndAssertOnErrorMessage = async({disablePayloadLogs, isPayloadInErrorMessage}) => {
            const errorMessage = 'Encountered invocation error';
            const originalErrorMessage = 'Exception raised during execution.';
            const originalErrorType = 'Exception';
            const originalStackTrace = '["File \\"/var/task/lambda_function.py\\", line 9, in lambda_handler, raise Exception(\\"Exception raised during execution.\\")"]';
            const invocationResults = {
                Payload: toByteArray(`{"errorMessage": "${originalErrorMessage}", ` +
                    `"errorType": "${originalErrorType}", "requestId": "c9e545c9-373c-402b-827f-e1c19af39e99", ` +
                    `"stackTrace": ${originalStackTrace}}`),
                FunctionError: 'Unhandled',
            };
            const actualPayload = 'TEST_PAYLOAD';

            try {
                utils.handleLambdaInvocationError(errorMessage, invocationResults, actualPayload, disablePayloadLogs);
            } catch (error) {
                expect(error.message).to.contain(errorMessage);
                expect(error.message).to.contain(originalErrorMessage);
                expect(error.message).to.contain(originalErrorType);
                expect(error.message).to.contain(originalStackTrace);
                expect(error.message.includes(actualPayload)).to.be(isPayloadInErrorMessage);
            }
        };

        it('should NOT contain not payload in error message if display payload logging is disabled', async() => invokeLambdaForInvocationErrorAndAssertOnErrorMessage({
            disablePayloadLogs: true,
            isPayloadInErrorMessage: false,
        }));

        it('should contain payload in error message if display payload logging is NOT disabled', async() => invokeLambdaForInvocationErrorAndAssertOnErrorMessage({
            disablePayloadLogs: false,
            isPayloadInErrorMessage: true,
        }));

        it('should contain payload in error message if disablePayloadLogs is undefined', async() => invokeLambdaForInvocationErrorAndAssertOnErrorMessage({
            disablePayloadLogs: undefined,
            isPayloadInErrorMessage: true,
        }));
    });

    describe('convertPayload', () => {

        it('should JSON-encode strings, if not JSON strings already', async() => {
            const strings = [
                'test',
                '',
                ' ',
            ];
            strings.forEach(s => {
                expect(utils.convertPayload(s)).to.be('"' + s + '"');
                expect(isJsonString(utils.convertPayload(s))).to.be(true);
            });
        });

        it('should return already a JSON-encoded string as is', async() => {
            const strings = [
                '{"test": true}',
                '[]',
                'true',
                'null',
            ];
            strings.forEach(s => {
                expect(utils.convertPayload(s)).to.be(s);
                expect(isJsonString(utils.convertPayload(s))).to.be(true);
            });
        });

        it('should return undefined when undefined is given', async() => {
            expect(utils.convertPayload()).to.be(undefined);
            expect(utils.convertPayload(undefined)).to.be(undefined);
        });

        it('should convert everything else to string', async() => {
            expect(utils.convertPayload(null)).to.be('null');
            expect(utils.convertPayload({})).to.be('{}');
            expect(utils.convertPayload({ test: true })).to.be('{"test":true}');
            expect(utils.convertPayload([])).to.be('[]');
            expect(utils.convertPayload([1, 2, 3])).to.be('[1,2,3]');
            expect(utils.convertPayload(['ok', {}])).to.be('["ok",{}]');
        });
    });

    describe('generatePayloads', () => {

        it('should generate a list of the same payload, if not weighted', async() => {
            const payload = { test: true };

            const output = utils.generatePayloads(10, payload);
            expect(output.length).to.be(10);
            output.forEach(p => {
                expect(p).to.be('{"test":true}');
                expect(isJsonString(p)).to.be(true);
            });
        });

        it('should generate a list of encoded JSON strings, if not weighted', async() => {
            const payload = 'just a string';

            const output = utils.generatePayloads(10, payload);
            expect(output.length).to.be(10);
            output.forEach(p => {
                expect(p).to.be('"just a string"');
                expect(isJsonString(p)).to.be(true);
            });
        });

        it('should return input array as output if not weighted', async() => {
            let payloads = [
                [],
                [{}],
                [1, 2, 3],
                [{ weight: 1 }],
                [{ payload: {}, weight: 1 }, { payload: {}}],
                [{ payload: {} }],
            ];

            payloads.forEach(payload => {
                let output = utils.generatePayloads(10, payload);

                expect(output.length).to.be(10);
                expect(output.every(p => p === JSON.stringify(payload))).to.be(true);
            });
        });

        it('should explode if num < count(payloads)', async() => {
            const weightedPayload = [ // 6 weighted payloads
                { weight: 1, payload: {} },
                { weight: 1, payload: { test: 1 } },
                { weight: 1, payload: { test: 2 } },
                { weight: 1, payload: { ok: 1 } },
                { weight: 1, payload: { ok: 2 } },
                { weight: 1, payload: { ok: 3 } },
            ];
            expect(() => utils.generatePayloads(5, weightedPayload)).to.throwError();
        });

        it('should return weighted payloads (100/2)', async() => {
            const weightedPayload = [
                { payload: { test: 'A' }, weight: 1 },
                { payload: { test: 'B' }, weight: 1 },
            ];

            const counters = {
                A: 0, B: 0,
            };

            const output = utils.generatePayloads(100, weightedPayload);
            expect(output.length).to.be(100);

            output.forEach(payload => {
                counters[JSON.parse(payload).test] += 1;
            });

            expect(counters.A).to.be(50);
            expect(counters.B).to.be(50);
        });

        it('should return weighted payloads (100/3)', async() => {
            const weightedPayload = [
                { payload: { test: 'A' }, weight: 1 },
                { payload: { test: 'B' }, weight: 1 },
                { payload: { test: 'C' }, weight: 1 },
            ];

            const counters = {
                A: 0, B: 0, C: 0,
            };

            const output = utils.generatePayloads(100, weightedPayload);
            expect(output.length).to.be(100);

            output.forEach(payload => {
                expect(payload).to.be.a('string');
                counters[JSON.parse(payload).test] += 1;
            });

            expect(counters.A).to.be(33);
            expect(counters.B).to.be(33);
            expect(counters.C).to.be(34); // the last payload will fill the missing gap
        });

        it('should return weighted payloads (20/3)', async() => {
            const weightedPayload = [
                { payload: { test: 'A' }, weight: 1 },
                { payload: { test: 'B' }, weight: 1 },
                { payload: { test: 'C' }, weight: 1 },
            ];

            const counters = {
                A: 0, B: 0, C: 0,
            };

            const output = utils.generatePayloads(20, weightedPayload);
            expect(output.length).to.be(20);

            output.forEach(payload => {
                expect(payload).to.be.a('string');
                counters[JSON.parse(payload).test] += 1;
            });

            expect(counters.A).to.be(6);
            expect(counters.B).to.be(6);
            expect(counters.C).to.be(8); // the last payload will fill the missing gap
        });

        it('should return weighted payloads (10/1)', async() => {
            const weightedPayload = [
                { payload: { test: 'A' }, weight: 1 },
            ];

            const counters = {
                A: 0,
            };

            const output = utils.generatePayloads(10, weightedPayload);
            expect(output.length).to.be(10);

            output.forEach(payload => {
                expect(payload).to.be.a('string');
                counters[JSON.parse(payload).test] += 1;
            });

            expect(counters.A).to.be(10);
        });

        it('should return weighted payloads (23/4)', async() => {
            const weightedPayload = [
                { payload: { test: 'A' }, weight: 1 },
                { payload: { test: 'B' }, weight: 1 },
                { payload: { test: 'C' }, weight: 1 },
                { payload: { test: 'D' }, weight: 1 },
            ];

            const counters = {
                A: 0, B: 0, C: 0, D: 0,
            };

            const output = utils.generatePayloads(23, weightedPayload);
            expect(output.length).to.be(23);

            output.forEach(payload => {
                expect(payload).to.be.a('string');
                counters[JSON.parse(payload).test] += 1;
            });

            expect(counters.A).to.be(5);
            expect(counters.B).to.be(5);
            expect(counters.C).to.be(5);
            expect(counters.D).to.be(8);
        });

        it('should return weighted payloads (54/5)', async() => {
            const weightedPayload = [
                { payload: { test: 'A' }, weight: 1 },
                { payload: { test: 'B' }, weight: 1 },
                { payload: { test: 'C' }, weight: 1 },
                { payload: { test: 'D' }, weight: 1 },
                { payload: { test: 'E' }, weight: 1 },
            ];

            const counters = {
                A: 0, B: 0, C: 0, D: 0, E: 0,
            };

            const output = utils.generatePayloads(54, weightedPayload);
            expect(output.length).to.be(54);

            output.forEach(payload => {
                expect(payload).to.be.a('string');
                counters[JSON.parse(payload).test] += 1;
            });

            expect(counters.A).to.be(10);
            expect(counters.B).to.be(10);
            expect(counters.C).to.be(10);
            expect(counters.D).to.be(10);
            expect(counters.E).to.be(14);
        });

        it('should return weighted payloads (30/26)', async() => {
            const weightedPayload = [
                { payload: { test: '1' }, weight: 1 },
                { payload: { test: '2' }, weight: 1 },
                { payload: { test: '3' }, weight: 1 },
                { payload: { test: '4' }, weight: 1 },
                { payload: { test: '5' }, weight: 1 },
                { payload: { test: '6' }, weight: 1 },
                { payload: { test: '7' }, weight: 1 },
                { payload: { test: '8' }, weight: 1 },
                { payload: { test: '9' }, weight: 1 },
                { payload: { test: '10' }, weight: 1 },
                { payload: { test: '11' }, weight: 1 },
                { payload: { test: '12' }, weight: 1 },
                { payload: { test: '13' }, weight: 1 },
                { payload: { test: '14' }, weight: 1 },
                { payload: { test: '15' }, weight: 1 },
                { payload: { test: '16' }, weight: 1 },
                { payload: { test: '17' }, weight: 1 },
                { payload: { test: '18' }, weight: 1 },
                { payload: { test: '19' }, weight: 1 },
                { payload: { test: '20' }, weight: 1 },
                { payload: { test: '21' }, weight: 1 },
                { payload: { test: '22' }, weight: 1 },
                { payload: { test: '23' }, weight: 1 },
                { payload: { test: '24' }, weight: 1 },
                { payload: { test: '25' }, weight: 1 },
                { payload: { test: '26' }, weight: 1 },
            ];

            const counters = {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
                11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0,
                21: 0, 22: 0, 23: 0, 24: 0, 25: 0, 26: 0,
            };

            const output = utils.generatePayloads(30, weightedPayload);
            expect(output.length).to.be(30);

            output.forEach(payload => {
                expect(payload).to.be.a('string');
                counters[JSON.parse(payload).test] += 1;
            });

            for (let i = 1; i < 26; i++) {
                expect(counters[i]).to.be(1);
            }
            expect(counters[26]).to.be(1 + 4);
        });

    });

    describe('isWeightedPayload', () => {
        it('should return true for a correctly weighted payload', () => {
            const validPayload = [
                { payload: { data: 'foo' }, weight: 5 },
                { payload: { data: 'bar' }, weight: 10 },
            ];
            expect(utils.isWeightedPayload(validPayload)).to.be(true);
        });

        it('should return false for payload only containing weights (no "payload" property)', () => {
            const validPayload = [
                { weight: 5 },
                { weight: 10 },
            ];
            expect(utils.isWeightedPayload(validPayload)).to.be(false);
        });

        it('should return false for a payload that is not an array', () => {
            const invalidPayload = { payload: { data: 'foo' }, weight: 5 };
            expect(utils.isWeightedPayload(invalidPayload)).to.be(false);
        });

        it('should return false for an undefined payload', () => {
            const invalidPayload = undefined;
            expect(utils.isWeightedPayload(invalidPayload)).to.be(false);
        });

        it('should return false for an empty array payload', () => {
            const invalidPayload = [];
            expect(utils.isWeightedPayload(invalidPayload)).to.be(false);
        });

        it('should return false for an invalid payload array (elements missing weight property)', () => {
            const invalidPayload = [
                { payload: { data: 'foo' } },
                { payload: { data: 'bar' }, weight: 10 },
            ];
            expect(utils.isWeightedPayload(invalidPayload)).to.be(false);
        });

        it('should return false for an invalid payload (elements missing payload property)', () => {
            const invalidPayload = [
                { weight: 5 },
                { payload: { data: 'bar' }, weight: 10 },
            ];
            expect(utils.isWeightedPayload(invalidPayload)).to.be(false);
        });
    });

    describe('fetchPayloadFromS3', () => {

        it('should fetch the object from S3 if valid URI', async() => {
            const payload = await utils.fetchPayloadFromS3('s3://my-bucket/my-key.json');
            expect(payload).to.be.an('object');
            expect(payload.Value).to.be('OK');
        });

        const invalidURIs = [
            '',
            '/',
            'bucket/key.json',
            '/bucket/key.json',
            '/key.json',
            'key.json',
            's3://bucket/',
            's3://key.json',
            's3://',
        ];

        invalidURIs.forEach(async(uri) => {
            it(`should explode if invalid URI - ${uri}`, async() => {
                try {
                    await utils.fetchPayloadFromS3(uri);
                    throw new Error(`${uri} did not throw`);
                } catch (err) {
                    expect(err.message).to.contain('Invalid S3 path');
                }
            });
        });

        it('should throw if access denied', async() => {
            const err = new Error('Access Denied');
            err.$response = {
                statusCode: 403,
            };
            s3Mock.on(GetObjectCommand).callsFake(input => {
                throw err;
            });
            try {
                await utils.fetchPayloadFromS3('s3://bucket/key.json');
                throw new Error('Did not catch 403');
            } catch (err) {
                expect(err.message).to.contain('Permission denied');
            }
        });

        it('should throw if object not found', async() => {
            const err = new Error('Object not found');
            err.$response = {
                statusCode: 404,
            };
            s3Mock.on(GetObjectCommand).callsFake(input => {
                throw err;
            });
            try {
                await utils.fetchPayloadFromS3('s3://bucket/key.json');
                throw new Error('Did not catch 404');
            } catch (err) {
                expect(err.message).to.contain('does not exist');
            }
        });

        it('should throw if unknown error', async() => {
            const err = new Error('Whatever error');
            err.$response = {
                statusCode: 500,
            };
            s3Mock.on(GetObjectCommand).callsFake(input => {
                throw err;
            });
            try {
                await utils.fetchPayloadFromS3('s3://bucket/key.json');
                throw new Error('Did not catch unknown error');
            } catch (err) {
                expect(err.message).to.contain('Unknown error');
                expect(err.message).to.contain('Whatever error');
            }
        });

        const validJson = [
            '{"value": "ok"}',
            '[1, 2, 3]',
            '[{"value": "ok"}, {"value2": "ok2"}]',
        ];

        validJson.forEach(async(str) => {
            it('should parse string if valid json - ' + str, async() => {
                s3Mock.on(GetObjectCommand).resolves({
                    Body: {
                        transformToString: async(encoding) => {
                            return str;
                        },
                    },
                });

                const payload = await utils.fetchPayloadFromS3('s3://bucket/key.json');
                expect(payload).to.be.an('object');
            });
        });

        it('should return string if invalid json', async() => {
            var output = 'just a string';
            s3Mock.on(GetObjectCommand).resolves({
                Body: {
                    transformToString: async(encoding) => {
                        return output;
                    },
                },
            });

            const payload = await utils.fetchPayloadFromS3('s3://bucket/key.json');
            expect(payload).to.be.a('string');
            expect(payload).to.equal('just a string');
        });

    });

    describe('sleep', () => {

        it('should wait X milliseconds', async() => {

            const clock = sinon.useFakeTimers();

            // sleep 10 seconds
            // without await (time is "locked" with fake timers)
            utils.sleep(10000);

            // release all timers so we don't have to actually wait
            await clock.runAllAsync();
            clock.restore();

        });


    });

    describe('invokeLambda', () => {
        const alias = 'aliasName';
        const arn = 'arn:aws:lambda:eu-west-1:XXX:function:name';
        const payload = { testKey: 'test-value' };

        let consoleLogStub;

        const invokeLambdaAndAssertOnConsoleLog = async({ disablePayloadLogs, isPayloadInConsoleLog }) => {
            utils.invokeLambda(arn, alias, payload, disablePayloadLogs);

            const consoleLogArg = consoleLogStub.firstCall.args[0];

            expect(consoleLogArg).to.contain('Invoking function');
            expect(consoleLogArg.includes('with payload')).to.be(isPayloadInConsoleLog);
        };

        before(() => {
            if (consoleLogSetupStub) {
                consoleLogStub = consoleLogSetupStub;
            } else {
                consoleLogStub = sinon.stub(console, 'log');
            }
        });

        beforeEach(() => {
            consoleLogStub.resetHistory();
        });

        after(() => {
            if (!consoleLogSetupStub) {
                consoleLogStub.restore();
            }
        });

        it('should invoke lambda and share payload in console log when disablePayloadLogs is undefined', async() => invokeLambdaAndAssertOnConsoleLog({
            disablePayloadLogs: undefined,
            isPayloadInConsoleLog: true,
        }));
        it('should invoke lambda and share payload in console log when disablePayloadLogs is false', async() => invokeLambdaAndAssertOnConsoleLog({
            disablePayloadLogs: false,
            isPayloadInConsoleLog: true,
        }));
        it('should invoke lambda and not share payload in console log when disablePayloadLogs is true', async() => invokeLambdaAndAssertOnConsoleLog({
            disablePayloadLogs: true,
            isPayloadInConsoleLog: false,
        }));
    });

    describe('buildAliasString', () => {

        it('should return baseAlias if onlyColdStarts=false', async() => {
            const value = utils.buildAliasString('RAM128', false, 0);
            expect(value).to.be('RAM128');
        });
        it('should only require baseAlias', async() => {
            const value = utils.buildAliasString('RAM128');
            expect(value).to.be('RAM128');
        });
        it('should append index to baseAlias if onlyColdStarts=true', async() => {
            const value = utils.buildAliasString('RAM128', true, 1);
            expect(value).to.be('RAM128-1');
        });
    });

    describe('extractDurationFromJSON', () => {
        it('should handle pretty-printed logs from Powertools', () => {
            const prettyPrintedLog = `
            {
            "cold_start": true,
            "function_arn": "arn:aws:lambda:eu-west-1:123456789012:function:TestFunction",
            "function_memory_size": "128",
            "function_name": "TestFunction",
            "function_request_id": "test-id",
            "level": "INFO",
            "message": "Lambda invocation event",
            "timestamp": "2024-12-12T17:00:03.173Z",
            "type": "platform.report",
            "record": {
                "metrics": {
                "durationMs": 100.0,
                "initDurationMs": 200.0
                }
            }
            }`;
            const duration = utils.extractDurationFromJSON(prettyPrintedLog, utils.DURATIONS.durationMs);
            expect(duration).to.be(100.0);
        });
        it('should handle multiline pretty printed logs', () => {
            const logLine = `
            [{
                "cold_start": true,
                "function_arn": "arn:aws:lambda:eu-west-1:123456789012:function:TestFunction",
                "function_memory_size": "128",
                "function_name": "TestFunction",
                "function_request_id": "test-id",
                "level": "INFO",
                "message": "Lambda invocation event",
                "timestamp": "2024-12-12T17:00:03.173Z",
                "type": "platform.report",
                "record": {
                    "metrics": {
                    "durationMs": 100.0,
                    "initDurationMs": 200.0
                    }
                }
                },{
                "cold_start": true,
                "function_arn": "arn:aws:lambda:eu-west-1:123456789012:function:TestFunction",
                "function_memory_size": "128",
                "function_name": "TestFunction",
                "function_request_id": "test-id",
                "level": "INFO",
                "message": "Lambda invocation event",
                "timestamp": "2024-12-12T17:00:03.173Z",
                "type": "platform.test",
                "record": {
                    "metrics": {
                    "durationMs": 100.0,
                    "initDurationMs": 200.0
                    }
                }
            }]`;
            const duration = utils.extractDurationFromJSON(logLine, utils.DURATIONS.durationMs);
            expect(duration).to.be(100.0);
        });
        it('should handle empty lines in logs pretty printed', () => {
            const logWithEmptyLines = `

            [
        
        {
        "type": "platform.report",
        "record": {
            "metrics": {
            "durationMs": 100.0
            }
        }
        }
        ,
        {
        "some": "other log"
        }
        
            ]

        `;
            const duration = utils.extractDurationFromJSON(logWithEmptyLines, utils.DURATIONS.durationMs);
            expect(duration).to.be(100.0);
        });
        it('should handle logs with no platform.report', () => {
            const logWithNoPlatformReport = `
    {
      "message": "some log"
    }
    {
      "another": "log"
    }`;
            expect(() => utils.extractDurationFromJSON(logWithNoPlatformReport, utils.DURATIONS.durationMs)).to.throwError();
        });
        it('should handle logs with no platform.report', () => {
            const logWithoutDurationMS = `
            {
            "cold_start": true,
            "function_arn": "arn:aws:lambda:eu-west-1:123456789012:function:TestFunction",
            "function_memory_size": "128",
            "function_name": "TestFunction",
            "function_request_id": "test-id",
            "level": "INFO",
            "message": "Lambda invocation event",
            "timestamp": "2024-12-12T17:00:03.173Z",
            "type": "platform.report",
            "record": {
                "metrics": {
                "initDurationMs": 200.0
                }
            }
            }`;
            expect(() => utils.extractDurationFromJSON(logWithoutDurationMS, utils.DURATIONS.durationMs)).to.throwError();
        });
    });
});
