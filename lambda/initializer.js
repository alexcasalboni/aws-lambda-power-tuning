'use strict';

const utils = require('./utils');

const SENTINEL = "OK";

const powerValues = process.env.powerValues.split(',');


/**
 * Initialize versions & aliases for next branches.
 */
module.exports.handler = (event, context, callback) => {

    const lambdaARN = event.lambdaARN;

    if (!lambdaARN) {
        throw new Error("Missing or empty lambdaARN");
    }

    if (!powerValues.length) {
        throw new Error("Missing or empty env.powerValues");
    }

    var queue = Promise.resolve();

    powerValues.forEach(function(value) {

        const alias = "RAM" + value;

        queue = queue
            // alias should not exist (check it first)
            .then(utils.checkLambdaAlias.bind(null, lambdaARN, alias))
            .catch(function(error) {
                // proceed with sentinel, on error
                return Promise.resolve(SENTINEL);
            })
            .then(function(data) {
                // proceed to next value, if sentinel
                if (data != SENTINEL) {
                    throw new Error("Alias already exists");
                }
                // proceed to next promise otherwise
                return Promise.resolve(SENTINEL);
            })
            .then(utils.setLambdaPower.bind(null, lambdaARN, value))
            .then(utils.publishLambdaVersion.bind(null, lambdaARN, alias))
            // createLambdaAlias could throw the same 'Alias already exists' error
            .then(function(data) {
                return utils.createLambdaAlias(lambdaARN, alias, data.Version);
            })
            .catch(function(error) {
                if (error.message && error.message.includes('Alias already exists')) {
                    // proceed to next value if alias already exists
                    return Promise.resolve(SENTINEL);
                } else {
                    callback(error);  // end of function (critial error)
                }
            });

    });


    return queue
        .then(function() {
            callback(null, SENTINEL);  // end of function
        })
        .catch(function(err) {
            console.error(err);
            callback(err);
        })

};

