'use strict';

const utils = require('./utils');

/**
 * Check if the LMI function version is active and set scaling config.
 * Returns {ready: true} when done, {ready: false} when still waiting.
 * Used in a Step Functions Wait+poll loop.
 */
module.exports.handler = async(event, context) => {
    const {lmiFunctionArn, functionVersion} = event;

    // Check if the function version is active
    const {isPending, state, stateReason} = await utils.getLambdaConfig(lmiFunctionArn, functionVersion);
    console.log(`Function version ${functionVersion} state: ${state}, isPending: ${isPending}`);

    if (state === 'Failed') {
        throw new Error(`Function version ${functionVersion} failed: ${stateReason}`);
    }

    if (isPending) {
        return {ready: false};
    }

    // Version is active — set scaling config
    try {
        await utils.putFunctionScalingConfig(lmiFunctionArn, functionVersion, 1, 1);
        console.log('Scaling config set successfully');
        return {ready: true};
    } catch (error) {
        console.log(`Scaling config not ready yet: ${error.message}`);
        return {ready: false};
    }
};
