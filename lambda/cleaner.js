'use strict';

const utils = require('./utils');

/**
 * Delete aliases and versions.
 */
module.exports.handler = async(event, context) => {

    const {lambdaARN, powerValues} = event;

    validateInput(lambdaARN, powerValues); // may throw

    const ops = powerValues.map(async(value) => {
        const alias = 'RAM' + value;
        await cleanup(lambdaARN, alias); // may throw
    });

    // run everything in parallel and wait until completed
    await Promise.all(ops);

    return 'OK';
};

const validateInput = (lambdaARN, powerValues) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!powerValues || !powerValues.length) {
        throw new Error('Missing or empty power values');
    }
};

const cleanup = async(lambdaARN, alias) => {
    try {
        // check if it exists and fetch version ID
        const {FunctionVersion} = await utils.getLambdaAlias(lambdaARN, alias);
        // delete both alias and version (could be done in parallel!)
        await utils.deleteLambdaAlias(lambdaARN, alias);
        await utils.deleteLambdaVersion(lambdaARN, FunctionVersion);
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.error('OK, even if version/alias was not found');
            console.error(error);
        } else {
            console.error(error);
            throw error;
        }
    }
};
