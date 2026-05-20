'use strict';

const sinon = require('sinon');
const expect = require('expect.js');

process.env.sfCosts = '{"default": 0.000025}';
process.env.baseCosts = '{"x86_64": {"default":2.1e-9}, "arm64": {"default":1.7e-9}}';
process.env.AWS_REGION = 'us-east-1';
process.env.visualizationURL = 'https://test.example.com/';

const utils = require('../../lambda/utils');
const handler = require('../../lambda/lmi-cleaner').handler;

const sandBox = sinon.createSandbox();
const fakeContext = {};

const validEvent = {
    lambdaARN: 'arn:aws:lambda:us-east-1:123456789:function:myFunc',
    lmiSetup: {
        capacityProviderName: 'pt-myFunc-12345',
        lmiFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:pt-myFunc-12345-fn',
    },
};

describe('lmi-cleaner', () => {

    let deleteFnStub, deleteCpStub;

    beforeEach(() => {
        deleteFnStub = sandBox.stub(utils, 'deleteLambdaFunction').resolves({});
        deleteCpStub = sandBox.stub(utils, 'deleteCapacityProvider').resolves({});
    });

    afterEach(() => {
        sandBox.restore();
    });

    describe('successful cleanup', () => {
        it('should delete LMI function and capacity provider', async() => {
            const result = await handler(validEvent, fakeContext);

            expect(result).to.be('OK');
            expect(deleteFnStub.calledOnce).to.be(true);
            expect(deleteCpStub.calledOnce).to.be(true);
        });

        it('should pass correct LMI function ARN to delete', async() => {
            await handler(validEvent, fakeContext);

            expect(deleteFnStub.firstCall.args[0]).to.be(
                'arn:aws:lambda:us-east-1:123456789:function:pt-myFunc-12345-fn',
            );
        });

        it('should pass correct capacity provider name to delete', async() => {
            await handler(validEvent, fakeContext);

            expect(deleteCpStub.firstCall.args[0]).to.be('pt-myFunc-12345');
            expect(deleteCpStub.firstCall.args[1]).to.be('us-east-1');
        });
    });

    describe('idempotent cleanup', () => {
        it('should continue if deleteLambdaFunction fails', async() => {
            deleteFnStub.rejects(new Error('Function not found'));

            const result = await handler(validEvent, fakeContext);

            expect(result).to.be('OK');
            expect(deleteCpStub.calledOnce).to.be(true);
        });

        it('should continue if deleteCapacityProvider fails', async() => {
            deleteCpStub.rejects(new Error('CP not found'));

            const result = await handler(validEvent, fakeContext);

            expect(result).to.be('OK');
        });

        it('should handle missing lmiSetup gracefully', async() => {
            const event = {
                lambdaARN: validEvent.lambdaARN,
                capacityProviderName: 'pt-myFunc-12345',
            };

            const result = await handler(event, fakeContext);

            expect(result).to.be('OK');
            // No lmiFunctionArn so try derived function name
            expect(deleteFnStub.calledOnce).to.be(true);
            expect(deleteFnStub.firstCall.args[0]).to.be('pt-myFunc-12345-fn');
            expect(deleteCpStub.calledOnce).to.be(true);
        });

        it('should use capacityProviderName from top level if not in lmiSetup', async() => {
            const event = {
                lambdaARN: validEvent.lambdaARN,
                lmiSetup: {lmiFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:fn'},
                capacityProviderName: 'pt-fallback-cp',
            };

            await handler(event, fakeContext);

            expect(deleteCpStub.firstCall.args[0]).to.be('pt-fallback-cp');
        });
    });

    describe('multi-instance-type cleanup', () => {
        it('should clean up all instance type configs', async() => {
            const event = {
                lambdaARN: validEvent.lambdaARN,
                instanceTypeConfigs: [
                    {capacityProviderName: 'pt-fn-c8gxlarge-123'},
                    {capacityProviderName: 'pt-fn-m7gxlarge-123'},
                ],
            };

            const result = await handler(event, fakeContext);

            expect(result).to.be('OK');
            // Should try derived function names for both
            expect(deleteFnStub.callCount).to.be(2);
            expect(deleteFnStub.firstCall.args[0]).to.be('pt-fn-c8gxlarge-123-fn');
            expect(deleteFnStub.secondCall.args[0]).to.be('pt-fn-m7gxlarge-123-fn');
            // Should delete both capacity providers
            expect(deleteCpStub.callCount).to.be(2);
            expect(deleteCpStub.firstCall.args[0]).to.be('pt-fn-c8gxlarge-123');
            expect(deleteCpStub.secondCall.args[0]).to.be('pt-fn-m7gxlarge-123');
        });

        it('should continue cleanup if one target fails', async() => {
            deleteFnStub.onFirstCall().rejects(new Error('not found'));
            deleteCpStub.onFirstCall().rejects(new Error('not found'));

            const event = {
                lambdaARN: validEvent.lambdaARN,
                instanceTypeConfigs: [
                    {capacityProviderName: 'pt-fn-c8gxlarge-123'},
                    {capacityProviderName: 'pt-fn-m7gxlarge-123'},
                ],
            };

            const result = await handler(event, fakeContext);

            expect(result).to.be('OK');
            expect(deleteFnStub.callCount).to.be(2);
            expect(deleteCpStub.callCount).to.be(2);
        });
    });
});
