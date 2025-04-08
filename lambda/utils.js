'use strict';

const {
    CreateAliasCommand, DeleteAliasCommand, DeleteFunctionCommand, GetAliasCommand,
    GetFunctionConfigurationCommand, InvokeCommand, LambdaClient, PublishVersionCommand,
    UpdateAliasCommand, UpdateFunctionConfigurationCommand,
    waitUntilFunctionActive, waitUntilFunctionUpdated, ResourceNotFoundException,
} = require('@aws-sdk/client-lambda');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const url = require('url');


// local reference to this module
const utils = module.exports;

const DURATIONS = {
    durationMs: 'durationMs',
    initDurationMs: 'initDurationMs',
    restoreDurationMs: 'restoreDurationMs',
    billedDurationMs: 'billedDurationMs',
    billedRestoreDurationMs: 'billedRestoreDurationMs',
};
module.exports.DURATIONS = DURATIONS;

// cost of 6+N state transitions (AWS Step Functions)
/**
 * Computes the cost for all state transitions in this state machine execution
 */
module.exports.stepFunctionsCost = (nPower, onlyColdStarts, num) => {
    const baseCostPerTransition = this.stepFunctionsBaseCost();

    // 6 -> number of default state transition (no matter what)
    // nPower * 3 -> these are invoked nPower times: Executor + Publisher + IsCountReached
    var multiplier = 6 + nPower * 3;

    if (onlyColdStarts) {
        // 6 -> number of default state transition (no matter what)
        // nPower -> number of Executor branches happening in parallel
        // 2 * nPower * num -> number of loops (Publisher + IsCountReached)
        multiplier = 6 + nPower + 2 * nPower * num;
    }

    return +(baseCostPerTransition * multiplier).toFixed(5);
};

module.exports.stepFunctionsBaseCost = () => {
    const prices = JSON.parse(process.env.sfCosts);
    // assume the AWS_REGION variable is set for this function
    return this.baseCostForRegion(prices, process.env.AWS_REGION);
};

module.exports.lambdaBaseCost = (region, architecture) => {
    const prices = JSON.parse(process.env.baseCosts);
    const priceMap = prices[architecture];
    if (!priceMap){
        throw new Error('Unsupported architecture: ' + architecture);
    }
    return this.baseCostForRegion(priceMap, region);
};

module.exports.buildAliasString = (baseAlias, onlyColdStarts, index) => {
    let alias = baseAlias;
    if (onlyColdStarts) {
        alias += `-${index}`;
    }
    return alias;
};

module.exports.allPowerValues = () => {
    const increment = 64;
    const powerValues = [];
    for (let value = 128; value <= 3008; value += increment) {
        powerValues.push(value);
    }
    return powerValues;
};

/**
 * Check whether a Lambda Alias exists or not, and return its data.
 */
module.exports.getLambdaAlias = (lambdaARN, alias) => {
    console.log('Checking alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new GetAliasCommand(params));
};

/**
 * Return true if alias exist, false if it doesn't.
 */
module.exports.verifyAliasExistance = async(lambdaARN, alias) => {
    try {
        await utils.getLambdaAlias(lambdaARN, alias);
        return true;
    } catch (error) {
        console.log('Error during verifyAlias (probably OK!)');
        if (error instanceof ResourceNotFoundException) {
            // OK, the alias isn't supposed to exist
            console.log('OK, even if missing alias ');
            return false;
        } else {
            console.log('error during alias check:');
            throw error; // a real error :)
        }
    }
};

/**
 * Update power, publish new version, and create/update alias.
 */
module.exports.createPowerConfiguration = async(lambdaARN, value, alias, description) => {
    try {
        await utils.setLambdaPower(lambdaARN, value, description);

        // wait for function update to complete
        await utils.waitForFunctionUpdate(lambdaARN);

        const {Version} = await utils.publishLambdaVersion(lambdaARN);
        // alias is not passed in when restoring to the original Lambda configuration
        if (typeof alias === 'undefined'){
            console.log('No alias defined');
            return;
        }
        const aliasExists = await utils.verifyAliasExistance(lambdaARN, alias);
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
            console.log('error during config creation for value ' + value);
            throw error; // a real error :)
        }
    }
};

/**
 * Wait for the function's LastUpdateStatus to become Successful.
 * Documentation: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#functionUpdated-waiter
 * Why is this needed? https://aws.amazon.com/blogs/compute/coming-soon-expansion-of-aws-lambda-states-to-all-functions/
 */
module.exports.waitForFunctionUpdate = async(lambdaARN) => {
    console.log('Waiting for update to complete');
    const params = {
        FunctionName: lambdaARN,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return waitUntilFunctionUpdated({
        client: lambda,
        minDelay: 1,
    }, params);
};

module.exports.waitForAliasActive = async(lambdaARN, alias) => {
    console.log(`Waiting for alias ${alias} to be active`);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return waitUntilFunctionActive({
        client: lambda,
        maxDelay: 10 * 90,
    }, params);
};

/**
 * Retrieve a given Lambda Function's memory size (always $LATEST version)
 */
module.exports.getLambdaPower = async(lambdaARN) => {
    console.log('Getting current power value');
    const params = {
        FunctionName: lambdaARN,
        Qualifier: '$LATEST',
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    const config = await lambda.send(new GetFunctionConfigurationCommand(params));
    return {
        power: config.MemorySize,
        // we need to fetch env vars only to add a new one and force a cold start
        description: config.Description,
    };
};

/**
 * Retrieve a given Lambda Function's architecture and whether its state is Pending
 */
module.exports.getLambdaConfig = async(lambdaARN, alias) => {
    console.log(`Getting current function config for alias ${alias}`);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: alias,
    };
    let architecture, isPending;
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    const config = await lambda.send(new GetFunctionConfigurationCommand(params));
    if (typeof config.Architectures !== 'undefined') {
        architecture = config.Architectures[0];
    } else {
        architecture = 'x86_64';
    }
    if (typeof config.State !== 'undefined') {
        // see https://docs.aws.amazon.com/lambda/latest/dg/functions-states.html
        // the most likely state here is Pending, but it could also be
        // - Failed: it means the version creation failed (can't do much about it, the invocation will fail anyway)
        // - Inactive: it means the version hasn't been invoked for 14 days (can't happen because we always create new versions)
        isPending = config.State === 'Pending';
    } else {
        isPending = false;
    }
    return {architecture, isPending};
};

/**
 * Update a given Lambda Function's memory size (always $LATEST version).
 */
module.exports.setLambdaPower = (lambdaARN, value, description) => {
    console.log('Setting power to ', value);
    const params = {
        FunctionName: lambdaARN,
        MemorySize: parseInt(value, 10),
        // the Description field is used as a way to force new versions being published.
        // this is required when using Power Tuning with the onlyColdStart flag
        Description: description,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new UpdateFunctionConfigurationCommand(params));
};

/**
 * Publish a new Lambda Version (version number will be returned).
 */
module.exports.publishLambdaVersion = (lambdaARN /*, alias*/) => {
    console.log('Publishing new version');
    const params = {
        FunctionName: lambdaARN,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new PublishVersionCommand(params));
};

/**
 * Delete a given Lambda Version.
 */
module.exports.deleteLambdaVersion = (lambdaARN, version) => {
    console.log('Deleting version ', version);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: version,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new DeleteFunctionCommand(params));
};

/**
 * Create a new Lambda Alias and associate it with the given Lambda Version.
 */
module.exports.createLambdaAlias = (lambdaARN, alias, version) => {
    console.log('Creating Alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        FunctionVersion: version,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new CreateAliasCommand(params));
};

/**
 * Create a new Lambda Alias and associate it with the given Lambda Version.
 */
module.exports.updateLambdaAlias = (lambdaARN, alias, version) => {
    console.log('Updating Alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        FunctionVersion: version,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new UpdateAliasCommand(params));
};

/**
 * Delete a given Lambda Alias.
 */
module.exports.deleteLambdaAlias = (lambdaARN, alias) => {
    console.log('Deleting alias ', alias);
    const params = {
        FunctionName: lambdaARN,
        Name: alias,
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new DeleteAliasCommand(params));
};

/**
 * Invoke a (pre/post-)processor Lambda function and return its output (data.Payload).
 */
module.exports.invokeLambdaProcessor = async(processorARN, payload, preOrPost = 'Pre', disablePayloadLogs = false) => {
    const processorData = await utils.invokeLambda(processorARN, null, payload, disablePayloadLogs);
    if (processorData.FunctionError) {
        let errorMessage = `${preOrPost}Processor ${processorARN} failed`;
        utils.handleLambdaInvocationError(errorMessage, processorData, payload, disablePayloadLogs);
    }
    return processorData.Payload;
};

/**
 * Wrapper around Lambda function invocation with pre/post-processor functions.
 */
module.exports.invokeLambdaWithProcessors = async(lambdaARN, alias, payload, preARN, postARN, disablePayloadLogs) => {

    var actualPayload = payload; // might change based on pre-processor

    // first invoke pre-processor, if provided
    if (preARN) {
        console.log('Invoking pre-processor');
        // overwrite payload with pre-processor's output (only if not empty)
        const preProcessorOutput = await utils.invokeLambdaProcessor(preARN, payload, 'Pre', disablePayloadLogs);
        if (preProcessorOutput) {
            actualPayload = preProcessorOutput;
        }
    }

    // invoke function to be power-tuned
    const invocationResults = await utils.invokeLambda(lambdaARN, alias, actualPayload, disablePayloadLogs);

    // then invoke post-processor, if provided
    if (postARN) {
        console.log('Invoking post-processor');
        // note: invocation may have failed (invocationResults.FunctionError)
        await utils.invokeLambdaProcessor(postARN, invocationResults.Payload, 'Post', disablePayloadLogs);
    }

    return {
        actualPayload,
        invocationResults,
    };
};

/**
 * Invoke a given Lambda Function:Alias with payload and return its logs.
 */
module.exports.invokeLambda = (lambdaARN, alias, payload, disablePayloadLogs) => {
    let consoleLogMessage = `Invoking function ${lambdaARN}:${alias || '$LATEST'}`;
    if (!disablePayloadLogs) {
        consoleLogMessage += ` with payload ${JSON.stringify(payload)}`;
    }
    console.log(consoleLogMessage);
    const params = {
        FunctionName: lambdaARN,
        Qualifier: alias,
        Payload: payload,
        LogType: 'Tail', // will return logs
    };
    const lambda = utils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new InvokeCommand(params));
};

/**
 * Handle a Lambda invocation error and generate an error message containing original error type, message and trace.
 */
module.exports.handleLambdaInvocationError = (errorMessageToDisplay, invocationResults, actualPayload, disablePayloadLogs) => {
    const parsedResults = JSON.parse(Buffer.from(invocationResults.Payload));
    if (!disablePayloadLogs) {
        errorMessageToDisplay += ` with payload ${JSON.stringify(actualPayload)}`;
    }
    errorMessageToDisplay += ` - original error type: "${parsedResults.errorType}", ` +
        `original error message: "${parsedResults.errorMessage}",` +
        `trace: "${JSON.stringify(parsedResults.stackTrace)}"`;
    throw new Error(errorMessageToDisplay);
};

/**
 * Fetch the body of an S3 object, given an S3 path such as s3://BUCKET/KEY
 */
module.exports.fetchPayloadFromS3 = async(s3Path) => {
    console.log('Fetch payload from S3', s3Path);

    if (typeof s3Path !== 'string' || s3Path.indexOf('s3://') === -1) {
        throw new Error('Invalid S3 path, not a string in the format s3://BUCKET/KEY');
    }

    const URI = url.parse(s3Path);
    URI.pathname = decodeURIComponent(URI.pathname || '');

    const bucket = URI.hostname;
    const key = URI.pathname.slice(1);

    if (!bucket || !key) {
        throw new Error(`Invalid S3 path: "${s3Path}" (bucket: ${bucket}, key: ${key})`);
    }

    const data = await utils._fetchS3Object(bucket, key);

    try {
        // try to parse into JSON object
        return JSON.parse(data);
    } catch (_) {
        // otherwise return as is
        return data;
    }


};

module.exports._fetchS3Object = async(bucket, key) => {
    try {
        const s3Client = new S3Client({});
        const input = {
            Bucket: bucket,
            Key: key,
        };
        var response = await s3Client.send(new GetObjectCommand(input));
        return await response.Body.transformToString('utf-8');
    } catch (err) {
        var statusCode = err.statusCode;
        if (err.$response && err.$response.statusCode) {
            statusCode = err.$response.statusCode;
        }
        if (statusCode === 403) {
            throw new Error(
                `Permission denied when trying to read s3://${bucket}/${key}. ` +
                'You might need to re-deploy the app with the correct payloadS3Bucket parameter.',
            );
        } else if (statusCode === 404) {
            throw new Error(
                `The object s3://${bucket}/${key} does not exist. ` +
                'Make sure you are trying to access an existing object in the correct bucket.',
            );
        } else {
            throw new Error(`Unknown error when trying to read s3://${bucket}/${key}. ${err.message}`);
        }
    }
};

/**
 * Generate a list of `num` payloads (repeated or weighted)
 */
module.exports.generatePayloads = (num, payloadInput) => {
    if (utils.isWeightedPayload(payloadInput)) {
        // if weighted array, generate a list of payloads based on weights

        if (num < payloadInput.length) {
            throw new Error(`You have ${payloadInput.length} payloads and only "num"=${num}. Please increase "num".`);
        }

        // we use relative weights (not %), so here we compute the total weight
        const total = payloadInput.map(p => p.weight).reduce((a, b) => a + b, 0);

        // generate an array of num items (to be filled)
        const payloads = utils.range(num);

        // iterate over weighted payloads and fill the array based on relative weight
        let done = 0;
        for (let i = 0; i < payloadInput.length; i++) {
            const p = payloadInput[i];
            var howMany = Math.floor(p.weight * num / total);
            if (howMany < 1) {
                throw new Error('Invalid payload weight (num is too small)');
            }

            // make sure the last item fills the remaining gap
            if (i === payloadInput.length - 1) {
                howMany = num - done;
            }

            // finally fill the list with howMany items
            payloads.fill(utils.convertPayload(p.payload), done, done + howMany);
            done += howMany;
        }

        return payloads;
    } else {
        // if not an array, always use the same payload (still generate a list)
        const payloads = utils.range(num);
        payloads.fill(utils.convertPayload(payloadInput), 0, num);
        return payloads;
    }
};

/**
 * Check if payload is an array where each element contains the property "weight"
 */
module.exports.isWeightedPayload = (payload) => {
    /**
     * Return true only if the input is a non-empty array where the elements contain a weight property.
     * e.g. [{ "payload": {...}, "weight": 5 }, ...]
     */
    return Array.isArray(payload) && payload.every(p => p.weight && p.payload) && !!payload.length;
};

/**
 * Convert payload to string, if it's not a string already
 */
module.exports.convertPayload = (payload) => {
    /**
     * Return true only if the input is a JSON-encoded string.
     * For example, '"test"' or '{"key": "value"}'.
     */
    const isJsonString = (s) => {
        if (typeof s !== 'string')
            return false;

        try {
            JSON.parse(s);
        } catch (e) {
            return false;
        }
        return true;
    };

    // optionally convert everything into string
    if (typeof payload !== 'undefined' && !isJsonString(payload)) {
        // note: 'just a string' becomes '"just a string"'
        console.log('Converting payload to JSON string from ', typeof payload);
        payload = JSON.stringify(payload);
    }
    return payload;
};

/**
 * Compute average price, given average duration.
 */
module.exports.computePrice = (minCost, minRAM, value, duration) => {
    // it's just proportional to ms (ceiled) and memory value
    return Math.ceil(duration) * minCost * (value / minRAM);
};

module.exports.parseLogAndExtractDurations = (data) => {
    return data.map(log => {
        const logString = utils.base64decode(log.LogResult || '');
        // Total duration = duration + (initDuration or restoreDuration)
        // restoreDuration is present for SnapStart-enabled Lambda functions
        // initDuration is present for non-SnapStart Lambda functions
        // if either is missing, we assume it's 0
        return utils.extractDuration(logString, DURATIONS.durationMs) +
          utils.extractDuration(logString, DURATIONS.initDurationMs) +
          utils.extractDuration(logString, DURATIONS.restoreDurationMs);
    });
};
module.exports.parseLogAndExtractBilledDurations = (data) => {
    return data.map(log => {
        const logString = utils.base64decode(log.LogResult || '');
        // Total billed duration = billedDuration + billedRestoreDuration
        // billedDuration is present for all Lambda functions
        // billedRestoreDuration is present for SnapStart-enabled Lambda functions
        // if billedRestoreDuration is missing, we assume it's 0
        return utils.extractDuration(logString, DURATIONS.billedDurationMs) +
          utils.extractDuration(logString, DURATIONS.billedRestoreDurationMs);
    });
};

/**
 * Compute total cost
 */
module.exports.computeTotalCost = (minCost, minRAM, value, durations) => {
    if (!durations || !durations.length) {
        return 0;
    }

    // compute corresponding cost for each duration
    const costs = durations.map(duration => utils.computePrice(minCost, minRAM, value, duration));

    // sum all together
    return costs.reduce((a, b) => a + b, 0);
};

/**
 * Compute average duration
 */
module.exports.computeAverageDuration = (durations, discardTopBottom) => {
    if (!durations || !durations.length) {
        return 0;
    }

    // a percentage of durations will be discarded (trimmed mean)
    const toBeDiscarded = parseInt(durations.length * discardTopBottom, 10);

    if (discardTopBottom > 0 && toBeDiscarded === 0) {
        // not an error, but worth logging
        // this happens when you have less than 5 invocations
        // (only happens if dryrun or in tests)
        console.log('not enough results to discard');
    }

    const newN = durations.length - 2 * toBeDiscarded;

    // compute trimmed mean (discard a percentage of low/high values)
    const averageDuration = durations
        .sort(function(a, b) { return a - b; }) // sort numerically
        .slice(toBeDiscarded, toBeDiscarded > 0 ? -toBeDiscarded : durations.length) // discard first/last values
        .reduce((a, b) => a + b, 0) // sum all together
        / newN
    ;

    return averageDuration;
};

/**
 * Returns true if provided string is valid json, false otherwise
 * @param str string to check
 * @returns {boolean}
 */
module.exports.isValidJSON = (str) => {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Extract duration (in ms) from a given Lambda's CloudWatch log.
 */
module.exports.extractDuration = (log, durationType) => {
    if (!durationType){
        durationType = DURATIONS.durationMs; // default to `durationMs`
    }
    if (utils.isValidJSON(log)) {
        // extract from JSON (multi-line)
        return utils.extractDurationFromJSON(log, durationType);
    } else {
        // extract from text
        return utils.extractDurationFromText(log, durationType);
    }
};

function getRegex(durationType) {
    switch (durationType) {
    case DURATIONS.billedDurationMs:
        return /\tBilled Duration: (\d+) ms/m;
    case DURATIONS.initDurationMs:
        return /\tInit Duration: (\d+\.\d+) ms/m;
    case DURATIONS.durationMs:
        return /\tDuration: (\d+\.\d+) ms/m;
    case DURATIONS.restoreDurationMs:
        return /\tRestore Duration: (\d+\.\d+) ms/m;
    case DURATIONS.billedRestoreDurationMs:
        return /\tBilled Restore Duration: (\d+) ms/m;
    default:
        throw new Error(`Unknown duration type: ${durationType}`);
    }
}

/**
 * Extract duration (in ms) from a given text log and duration type.
 */
module.exports.extractDurationFromText = (log, durationType) => {
    let regex = getRegex(durationType);

    const match = regex.exec(log);
    // Default to 0 if the specific duration is not found in the log line
    if (match == null) return 0;
    return parseFloat(match[1], 10);
};

/**
 * Extract duration (in ms) from a given JSON log (multi-line)  and duration type.
 */
module.exports.extractDurationFromJSON = (log, durationType) => {
    // extract each line and parse it to JSON object
    const lines = log.split('\n').filter((line) => line.startsWith('{')).map((line) => {
        try {
            return JSON.parse(line);
        } catch (e) {
            console.error(`Detected invalid JSON line: ${line}`);
            return '';
        }
    });
    // find the log corresponding to the invocation report
    const durationLine = lines.find((line) => line.type === 'platform.report');
    if (durationLine){
        let field = durationType;
        // Default to 0 if the specific duration is not found in the log line
        return durationLine.record.metrics[field] || 0;
    }

    throw new Error('Unrecognized JSON log');
};


/**
 * Encode a given string to base64.
 */
module.exports.base64decode = (str) => {
    return Buffer.from(str, 'base64').toString();
};

/**
 * Generate a list of size n.
 */
module.exports.range = (n) => {
    if (n === null || typeof n === 'undefined') {
        n = -1;
    }
    return Array.from(Array(n).keys());
};

module.exports.regionFromARN = (arn) => {
    if (typeof arn !== 'string' || arn.split(':').length !== 7) {
        throw new Error('Invalid ARN: ' + arn);
    }
    return arn.split(':')[3];
};

module.exports.lambdaClientFromARN = (lambdaARN) => {
    const region = this.regionFromARN(lambdaARN);
    return new LambdaClient({
        region,
        maxAttempts: 20,
        requestTimeout: 15 * 60 * 1000,
    });
};

/**
 * Generate a URL with encoded stats.
 * Note: the URL hash is never sent to the server.
 */
module.exports.buildVisualizationURL = (stats, baseURL) => {

    function encode(inputList, EncodeType = null) {
        EncodeType = EncodeType || Float32Array;
        inputList = new EncodeType(inputList);
        inputList = new Uint8Array(inputList.buffer);
        return Buffer.from(inputList).toString('base64');
    }

    // sort by power
    stats.sort((p1, p2) => {
        return p1.power - p2.power;
    });

    const sizes = stats.map(p => p.power);
    const times = stats.map(p => p.duration);
    const costs = stats.map(p => p.cost);

    const hash = [
        encode(sizes, Int16Array),
        encode(times),
        encode(costs),
    ].join(';');

    if (process.env.AWS_REGION.startsWith('cn-')) {
        baseURL += '?currency=CNY';
    }

    return baseURL + '#' + hash;
};

/**
 * Using the prices supplied,
 * to figure what the base price is for the
 * supplied region.
 */
module.exports.baseCostForRegion = (priceMap, region) => {
    if (priceMap[region]) {
        return priceMap[region];
    }
    console.log(region + ' not found in base price map, using default: ' + priceMap['default']);
    return priceMap['default'];
};


module.exports.sleep = async(sleepBetweenRunsMs) => {
    await new Promise(resolve => setTimeout(resolve, sleepBetweenRunsMs));
};
