'use strict';

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

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
        var functionVersionWrapper = {};

        return Promise.resolve()
            .then(checkLambdaAlias.bind(null, lambdaARN, alias))
            .then(function(data) {  // (ugly workaround!)
                // just to pass it to deleteLambdaVersion
                functionVersionWrapper.FunctionVersion = data.FunctionVersion;
            })
            .then(deleteLambdaAlias.bind(null, lambdaARN, alias))
            .then(deleteLambdaVersion.bind(null, lambdaARN, functionVersionWrapper))
            .catch(function(error) {
                if (error.message.includes('version is not defined')) {
                    console.log("Version is not defined: ", error.message, error.stack);
                    return Promise.resolve("OK");
                } else if (error.message.includes('alias is not defined')) {
                    console.log("Alias is not defined: ", error.message, error.stack);
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

function checkLambdaAlias(lambdaARN, alias) {
    console.log("Checking alias ", alias);
    var params = {
        FunctionName: lambdaARN, 
        Name: alias,
    };
    return lambda.getAlias(params).promise();
}

function deleteLambdaAlias(lambdaARN, alias) {
    console.log("Deleting alias ", alias);
    var params = {
        FunctionName: lambdaARN, 
        Name: alias,
    };
    return lambda.deleteAlias(params).promise();
}

function deleteLambdaVersion(lambdaARN, data) {
    console.log("Deleting version ", data.FunctionVersion, " with data ", data);
    var params = {
        FunctionName: lambdaARN, 
        Qualifier: data.FunctionVersion,
    };
    return lambda.deleteFunction(params).promise();
}
