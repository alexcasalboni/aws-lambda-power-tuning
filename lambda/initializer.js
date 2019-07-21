'use strict';

const utils = require('./utils');

const powerValues = process.env.powerValues.split(',');


/**
 * Initialize versions & aliases for next branches.
 */
module.exports.handler = async (event, context) => {

    const lambdaARN = event.lambdaARN;
    const num = event.num;

    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }

    if (!powerValues.length) {
        throw new Error('Missing or empty env.powerValues');
    }

    if (!num || num < 5) {
        throw new Error('Missing num or num below 5')
    }

    // map or forEach?
    const ops = powerValues.map(async (value) => {

        const alias = 'RAM' + value;

        try {
            await utils.checkLambdaAlias(lambdaARN, alias);
        } catch (error) {
            if (error.message && error.message.includes('alias is not defined')) {
                // OK, the alias isn't supposed to exist
                console.log("OK, even if missing alias ");
            } else {
                throw error;  // a real error :)
            }
        }

        try {
            await utils.setLambdaPower(lambdaARN, value);
            const {Version} = await utils.publishLambdaVersion(lambdaARN);
            await utils.createLambdaAlias(lambdaARN, alias, Version);
        } catch (error) {
            if (error.message && error.message.includes('Alias already exists')) {
                // shouldn't happen, but nothing we can do in that case
                console.log("OK, even if: ", error);
            } else {
                throw error;  // a real error :)
            }
        }
    });

    // run everything in parallel and wait until completed
    await Promise.all(ops);

    return "OK";
};

