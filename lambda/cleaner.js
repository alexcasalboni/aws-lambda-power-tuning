'use strict';

const utils = require('./utils');
const powerValues = process.env.powerValues.split(',');

/**
 * Delete aliases and versions.
 */
module.exports.handler = async(event, context) => {

    const lambdaARN = event.lambdaARN;

    validateInput(lambdaARN); // may throw

    const ops = powerValues.map(async(value) => {
        const alias = 'RAM' + value;
        await cleanup(lambdaARN, alias); // may throw
    });

    // run everything in parallel and wait until completed
    await Promise.all(ops);

    return 'OK';
};

const validateInput = (lambdaARN) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!powerValues.length) {
        throw new Error('Missing or empty env.powerValues');
    }
};

const cleanup = async(lambdaARN, alias) => {
    try {
        // check if it exists and fetch version ID
        const {FunctionVersion} = await utils.checkLambdaAlias(lambdaARN, alias);
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
