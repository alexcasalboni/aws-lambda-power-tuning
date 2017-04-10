'use strict';

const utils = require('./utils');

const powerValues = process.env.powerValues.split(',');

/**
 * Clean aliases and versions.
 */
module.exports.handler = (event, context, callback) => {
  
    const lambdaARN = event.lambdaARN;

    if (!lambdaARN) {
        throw new Error("Missing or empty lambdaARN");
    }

    const aliasRemovals = powerValues.map(function(value) {

        const alias = "RAM" + value;
        var functionVersion = null;

        return Promise.resolve()
            .then(utils.checkLambdaAlias.bind(null, lambdaARN, alias))
            .then(function(data) {  // (ugly workaround!)
                // just to pass it to deleteLambdaVersion
                functionVersion = data.FunctionVersion;
            })
            .then(utils.deleteLambdaAlias.bind(null, lambdaARN, alias))
            .then(function() {
                return utils.deleteLambdaVersion(lambdaARN, functionVersion);
            })
            .catch(function(error) {
                if (error.message.includes('version is not defined')) {
                    console.error("Version is not defined: ", error.message, error.stack);
                    return Promise.resolve("OK");
                } else if (error.message.includes('alias is not defined')) {
                    console.error("Alias is not defined: ", error.message, error.stack);
                    return Promise.resolve("OK");
                }
            });
    });

    Promise
        .all(aliasRemovals)
        .then(function() {
            callback(null, "OK");
        })
        .catch(console.error.bind(console));

};

