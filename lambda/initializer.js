'use strict';

const utils = require('./utils');
const defaultPowerValues = process.env.defaultPowerValues.split(',');

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
        await utils.createPowerConfiguration(lambdaARN, value, alias);
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
