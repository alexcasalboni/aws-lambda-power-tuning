'use strict';

const utils = require('./utils');
const powerValues = process.env.powerValues.split(',');

/**
 * Delete aliases and versions.
 */
module.exports.handler = async (event, context) => {
  
    const lambdaARN = event.lambdaARN;

    validateInput(lambdaARN);  // may throw

    const ops = powerValues.map(async (value) => {
        const alias = 'RAM' + value;
        await cleanup(lambdaARN, alias);  // may throw
    });

    // run everything in parallel and wait until completed
    await Promise.all(ops);

    return "OK";
};

const validateInput = (lambdaARN) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!powerValues.length) {
        throw new Error('Missing or empty env.powerValues');
    }
}

const cleanup = async (lambdaARN, alias) => {
    try {
        // check if it exists and fetch version ID
        const {FunctionVersion} = await utils.checkLambdaAlias(lambdaARN, alias);
        // delete both alias and version (could be done in parallel!)
        await utils.deleteLambdaAlias(lambdaARN, alias);
        await utils.deleteLambdaVersion(lambdaARN, FunctionVersion);
    } catch (error) {
        if (error.message.includes('version is not defined')) {
            // shouldn't happen, but nothing we can/should do here
            console.error('OK, even if version is not defined');
        } else if (error.message.includes('alias is not defined')) {
            // shouldn't happen, but nothing we can/should do here
            console.error('OK, even if alias is not defined');
        } else {
            console.error(error);
            throw error;
        }
    }
}