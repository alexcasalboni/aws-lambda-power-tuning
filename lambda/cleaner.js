'use strict';

const { ResourceNotFoundException } = require('@aws-sdk/client-lambda');
const utils = require('./utils');

/**
 * Delete aliases and versions.
 */
module.exports.handler = async(event, context) => {

    const {
        lambdaARN,
        aliases,
    } = extractDataFromInput(event);

    validateInput(lambdaARN, aliases); // may throw

    const ops = aliases.map(async(alias) => {
        await cleanup(lambdaARN, alias);
    });

    // run everything in parallel and wait until completed
    await Promise.all(ops);

    return 'OK';
};

const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        aliases: event.powerValues.aliases,
    };
};

const validateInput = (lambdaARN, aliases) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!aliases || !aliases.length) {
        throw new Error('Missing or empty alias values');
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
        if (error instanceof ResourceNotFoundException) {
            console.error('OK, even if version/alias was not found');
            console.error(error);
        } else {
            console.error(error);
            throw error;
        }
    }
};
