
var functionArns;
var incrementalIndex;

const payloads = {
    sample: require('./sample.json'),
    sample2: require('./sample-2.json'),
    invalid: require('./sample-invalid.json'),
};

module.exports.init = (arns) => {
    functionArns = arns;
    incrementalIndex = 0;
    if (!Array.isArray(functionArns)) {
        functionArns = functionArns.split(',');
    }
    functionArns.forEach((arn, index) => {
        functionArns[index] = arn.trim(); // remove spaces
    });
}

module.exports.get = (name, functionName) => {
    const p = payloads[name];
    if (!p) {
        throw new Error("Invalid payload name:", name);
    }    

    if (functionName === undefined) {
        // if enough arns left
        if (incrementalIndex < functionArns.length) {
            functionName = functionArns[incrementalIndex++];
        } else {
            throw new Error("Not enough function arns to run tests");
        }
    }

    // replace function ARN in payload structure
    p.lambdaARN = functionName;

    return p;
};