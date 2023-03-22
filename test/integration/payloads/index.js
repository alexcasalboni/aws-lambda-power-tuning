
const FUNCTION_ARN = process.env.FUNCTION_ARN;

const payloads = {
    sample: require('./sample.json'),
    sample2: require('./sample-2.json'),
    invalid: require('./sample-invalid.json'),
};

module.exports.get = (name, functionName) => {
    const p = payloads[name];
    if (!p) {
        throw new Error("Invalid payload name", name);
    }    
    if (functionName === undefined && FUNCTION_ARN) {
        functionName = FUNCTION_ARN;
    }
    if (functionName) {
        p.lambdaARN = functionName;
    }
    return p;
};