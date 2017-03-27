'use strict';

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();
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

        queue = queue
            // alias should not exist (check it first)
            .then(checkLambdaAlias.bind(null, lambdaARN, value))
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
            .then(setLambdaPower.bind(null, lambdaARN, value))
            .then(publishLambdaVersion.bind(null, lambdaARN, value))
            // createLambdaAlias could throw the same 'Alias already exists' error
            .then(createLambdaAlias.bind(null, lambdaARN, value))
            .catch(function(error) {
                if (error.message.includes('Alias already exists')) {
                    // proceed to next value if alias already exists
                    return Promise.resolve(SENTINEL);
                }
            });
        
    });

    
    queue.then(function() {
        callback(null, SENTINEL);  // end of function
    });

    queue.catch(console.error.bind(console));  // unexpected errors

};

function checkLambdaAlias(lambdaARN, value) {
    // console.log("Checking alias for ", value);
    var params = {
        FunctionName: lambdaARN, 
        Name: "RAM" + value,
    };
    return lambda.getAlias(params).promise();
}

function setLambdaPower(lambdaARN, value) {
    // console.log("Setting power to ", value);
    var params = {
        FunctionName: lambdaARN, 
        MemorySize: parseInt(value),
    };
    return lambda.updateFunctionConfiguration(params).promise();
}

function publishLambdaVersion(lambdaARN, value) {
    // console.log("Publishing version for ", value);
    var params = {
        FunctionName: lambdaARN,
    };
    return lambda.publishVersion(params).promise();
}

function createLambdaAlias(lambdaARN, value, data) {
    // console.log("Creating Alias for ", value);
    var params = {
        FunctionName: lambdaARN,
        FunctionVersion: data.Version,
        Name: "RAM" + value,
    };
    return lambda.createAlias(params).promise();
}
