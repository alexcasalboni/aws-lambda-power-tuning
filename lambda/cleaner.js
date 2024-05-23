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
    if (onlyColdStarts){
        return powerValues.map((powerValue) => {
            return utils.range(num).map((index) => {
                return utils.buildAliasString(`RAM${powerValue}`, onlyColdStarts, index);
            });
        }).flat();
    }
    return powerValues.map((powerValue) => utils.buildAliasString(`RAM${powerValue}`));
};

const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        powerValues: event.lambdaConfigurations.powerValues,
        onlyColdStarts: event.onlyColdStarts,
        num: parseInt(event.num, 10), // parse as we do in the initializer
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
