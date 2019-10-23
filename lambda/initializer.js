'use strict';

const utils = require('./utils');
const defaultPowerValues = process.env.defaultPowerValues.split(',');

console.log("found default values: " + defaultPowerValues);

/**
 * Initialize versions & aliases so we can execute everything in parallel.
 */
module.exports.handler = async(event, context) => {

    const {lambdaARN, num} = event;
    const powerValues = extractPowerValues(event);

    validateInput(lambdaARN, num); // may throw

    // fetch initial $LATEST value so we can reset it later
    const initialPower = await utils.getLambdaPower(lambdaARN);

    // reminder: configuration updates must run sequencially
    // (otherwise you get a ResourceConflictException)
    for (let value of powerValues){
        const alias = 'RAM' + value;
        const aliasExists = await verifyAliasExistance(lambdaARN, alias);
        // console.log('aliasExists: ' + aliasExists);
        await createPowerConfiguration(lambdaARN, value, alias, aliasExists);
    }

    await utils.setLambdaPower(lambdaARN, initialPower);

    return powerValues;
};

const extractPowerValues = (event) => {
    var powerValues = event.powerValues; // could be undefined

    // auto-generate all possible values if ALL
    if (powerValues === 'ALL') {
        powerValues = utils.allPowerValues();
    }

    // use default list of values (defined at deploy-time) if not provided
    if (!powerValues || powerValues.length === 0) {
        powerValues = defaultPowerValues;
    }

    return powerValues;
};

const validateInput = (lambdaARN, num) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!num || num < 5) {
        throw new Error('Missing num or num below 5');
    }
};

const verifyAliasExistance = async(lambdaARN, alias) => {
    try {
        await utils.checkLambdaAlias(lambdaARN, alias);
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            // OK, the alias isn't supposed to exist
            console.log('OK, even if missing alias ');
            return false;
        } else {
            console.log('error during alias check:');
            throw error; // a real error :)
        }
    }
};

const createPowerConfiguration = async(lambdaARN, value, alias, aliasExists) => {
    try {
        await utils.setLambdaPower(lambdaARN, value);
        const {Version} = await utils.publishLambdaVersion(lambdaARN);
        if (aliasExists) {
            await utils.updateLambdaAlias(lambdaARN, alias, Version);
        } else {
            await utils.createLambdaAlias(lambdaARN, alias, Version);
        }
    } catch (error) {
        if (error.message && error.message.includes('Alias already exists')) {
            // shouldn't happen, but nothing we can do in that case
            console.log('OK, even if: ', error);
        } else {
            console.log('error during inizialization for value ' + value);
            throw error; // a real error :)
        }
    }
};
