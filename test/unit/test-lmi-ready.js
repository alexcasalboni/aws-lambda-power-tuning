'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

process.env.sfCosts = '{"default": 0.000025}';
process.env.baseCosts = '{"x86_64": {"default":2.1e-9}, "arm64": {"default":1.7e-9}}';
process.env.AWS_REGION = 'us-east-1';
process.env.visualizationURL = 'https://test.example.com/';

const utils = require('../../lambda/utils');
const handler = require('../../lambda/lmi-ready').handler;

const sandBox = sinon.createSandbox();
const fakeContext = {};

const validEvent = {
    lmiFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:pt-myFunc-12345-fn',
    functionVersion: '5',
};

describe('lmi-ready', () => {

    let getLambdaConfigStub, putScalingStub;

    beforeEach(() => {
        getLambdaConfigStub = sandBox.stub(utils, 'getLambdaConfig');
        putScalingStub = sandBox.stub(utils, 'putFunctionScalingConfig');
    });

    afterEach(() => {
        sandBox.restore();
    });

    it('should return ready=false when function version is pending', async() => {
        getLambdaConfigStub.resolves({isPending: true});

        const result = await handler(validEvent, fakeContext);

        expect(result.ready).to.be(false);
        expect(putScalingStub.called).to.be(false);
    });

    it('should return ready=true when version is active and scaling config succeeds', async() => {
        getLambdaConfigStub.resolves({isPending: false});
        putScalingStub.resolves({});

        const result = await handler(validEvent, fakeContext);

        expect(result.ready).to.be(true);
        expect(putScalingStub.calledOnce).to.be(true);
        const args = putScalingStub.firstCall.args;
        expect(args[0]).to.be(validEvent.lmiFunctionArn);
        expect(args[1]).to.be('5');
        expect(args[2]).to.be(1); // minEnvs
        expect(args[3]).to.be(1); // maxEnvs
    });

    it('should return ready=false when scaling config throws', async() => {
        getLambdaConfigStub.resolves({isPending: false});
        putScalingStub.rejects(new Error('ResourceConflictException'));

        const result = await handler(validEvent, fakeContext);

        expect(result.ready).to.be(false);
    });
});
