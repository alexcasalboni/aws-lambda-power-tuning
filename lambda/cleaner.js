'use strict';

const { ResourceNotFoundException } = require('@aws-sdk/client-lambda');
const utils = require('./utils');

/**
 * Delete aliases and versions.
 */
module.exports.handler = async(event, context) => {

    const {
        lambdaARN,
        powerValues,
        onlyColdStarts,
        num,
    } = extractDataFromInput(event);

    validateInput(lambdaARN, powerValues); // may throw

    // build list of aliases to clean up
    const aliases = buildAliasListForCleanup(lambdaARN, onlyColdStarts, powerValues, num);

    const ops = aliases.map(async(alias) => {
        await cleanup(lambdaARN, alias);
    });

    // run everything in parallel and wait until completed
    await Promise.all(ops);

    return 'OK';
};

const buildAliasListForCleanup = (lambdaARN, onlyColdStarts, powerValues, num) => {
    let aliases;
    if (onlyColdStarts){
        aliases = powerValues.map((powerValue) => utils.range(num).map((value) => utils.buildAliasString(`RAM${powerValue}`, onlyColdStarts, value))).flat();
    } else {
        aliases = powerValues.map((powerValue) => utils.buildAliasString(`RAM${powerValue}`));
    }
    return aliases;
};
const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        powerValues: event.lambdaConfigurations.powerValues,
        onlyColdStarts: event.onlyColdStarts,
        num: parseInt(event.num, 10), // use the default in case it was not defined
    };
};

const validateInput = (lambdaARN, powerValues) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!powerValues || !powerValues.length) {
        throw new Error('Missing or empty powerValues values');
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
