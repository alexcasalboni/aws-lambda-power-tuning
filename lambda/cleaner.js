'use strict';

const utils = require('./utils');

const powerValues = process.env.powerValues.split(',');

/**
 * Clean aliases and versions.
 */
module.exports.handler = (event, context, callback) => {
  
    const lambdaARN = event.lambdaARN;

    if (!lambdaARN) {
        const error = new Error('Missing or empty lambdaARN');
        callback(error);
        throw error;  // TODO useless?
    }

    if (!powerValues.length) {
        const error = new Error('Missing or empty env.powerValues');
        callback(error);
        throw error;  // TODO useless?
    }

    const aliasRemovals = powerValues.map(function(value) {

        const alias = 'RAM' + value;
        var functionVersion = null;

        return Promise.resolve()
            .then(utils.checkLambdaAlias.bind(null, lambdaARN, alias))
            .then(function(data) {
                // workaround to pass functionVersion to deleteLambdaVersion
                functionVersion = data.FunctionVersion;
            })
            .then(utils.deleteLambdaAlias.bind(null, lambdaARN, alias))
            .then(function() {
                return utils.deleteLambdaVersion(lambdaARN, functionVersion);
            })
            .catch(function(error) {
                if (error.message.includes('version is not defined')) {
                    console.error('Version is not defined: ', error.message, error.stack);
                    return Promise.resolve('OK');
                } else if (error.message.includes('alias is not defined')) {
                    console.error('Alias is not defined: ', error.message, error.stack);
                    return Promise.resolve('OK');
                }
            });
    });

    return Promise
        .all(aliasRemovals)
        .then(function() {
            callback(null, 'OK');
        })
        .catch(function(err) {
            console.error(err);
            callback(err);
        });

};

