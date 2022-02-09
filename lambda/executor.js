'use strict';

const AWS = require('aws-sdk');

// the executor needs a longer socket timeout to invoke long-running functions
// 15 minutes is fine here because the Executor will timeout anyway
AWS.config.update({httpOptions: {timeout: 15 * 60 * 1000}});

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM, 10);

/**
 * Execute the given function N times in series or in parallel.
 * Then compute execution statistics (averate cost and duration).
 */
module.exports.handler = async(event, context) => {
    // read input from event
    let {
        lambdaARN,
        value,
        num,
        enableParallel,
        payload,
        dryRun,
        preProcessorARN,
        postProcessorARN,
    } = await extractDataFromInput(event);

    validateInput(lambdaARN, value, num); // may throw

    // force only 1 execution if dryRun
    if (dryRun) {
        console.log('[Dry-run] forcing num=1');
        num = 1;
    }

    const lambdaAlias = 'RAM' + value;
    let results;

    // fetch architecture from $LATEST
    const architecture = await utils.getLambdaArchitecture(lambdaARN);
    console.log(`Detected architecture type: ${architecture}`);

    // pre-generate an array of N payloads
    const payloads = utils.generatePayloads(num, payload);

    if (enableParallel) {
        results = await runInParallel(num, lambdaARN, lambdaAlias, payloads, preProcessorARN, postProcessorARN);
    } else {
        results = await runInSeries(num, lambdaARN, lambdaAlias, payloads, preProcessorARN, postProcessorARN);
    }

    // get base cost for Lambda
    const baseCost = utils.lambdaBaseCost(utils.regionFromARN(lambdaARN), architecture);

    return computeStatistics(baseCost, results, value);
};

const validateInput = (lambdaARN, value, num) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!value || isNaN(value)) {
        throw new Error('Invalid value: ' + value);
    }
    if (!num || isNaN(num)) {
        throw new Error('Invalid num: ' + num);
    }
};

const extractPayloadValue = async(input) => {
    if (input.payloadS3) {
        return await utils.fetchPayloadFromS3(input.payloadS3); // might throw if access denied or 404
    } else if (input.payload) {
        return input.payload;
    }
    return null;
};

const extractDataFromInput = async(event) => {
    const input = event.input; // original state machine input
    const payload = await extractPayloadValue(input);
    return {
        value: parseInt(event.value, 10),
        lambdaARN: input.lambdaARN,
        num: parseInt(input.num, 10),
        enableParallel: !!input.parallelInvocation,
        payload: payload,
        dryRun: input.dryRun === true,
        preProcessorARN: input.preProcessorARN,
        postProcessorARN: input.postProcessorARN,
    };
};

const runInParallel = async(num, lambdaARN, lambdaAlias, payloads, preARN, postARN) => {
    const results = [];
    // run all invocations in parallel ...
    const invocations = utils.range(num).map(async(_, i) => {
        const {invocationResults, actualPayload} = await utils.invokeLambdaWithProcessors(lambdaARN, lambdaAlias, payloads[i], preARN, postARN);
        // invocation errors return 200 and contain FunctionError and Payload
        if (invocationResults.FunctionError) {
            throw new Error(`Invocation error (running in parallel): ${invocationResults.Payload} with payload ${JSON.stringify(actualPayload)}`);
        }
        results.push(invocationResults);
    });
    // ... and wait for results
    await Promise.all(invocations);
    return results;
};

const runInSeries = async(num, lambdaARN, lambdaAlias, payloads, preARN, postARN) => {
    const results = [];
    for (let i = 0; i < num; i++) {
        // run invocations in series
        const {invocationResults, actualPayload} = await utils.invokeLambdaWithProcessors(lambdaARN, lambdaAlias, payloads[i], preARN, postARN);
        // invocation errors return 200 and contain FunctionError and Payload
        if (invocationResults.FunctionError) {
            throw new Error(`Invocation error (running in series): ${invocationResults.Payload} with payload ${JSON.stringify(actualPayload)}`);
        }
        results.push(invocationResults);
    }
    return results;
};

const computeStatistics = (baseCost, results, value) => {
    // use results (which include logs) to compute average duration ...

    const durations = utils.parseLogAndExtractDurations(results);

    const averageDuration = utils.computeAverageDuration(durations);
    console.log('Average duration: ', averageDuration);

    // ... and overall statistics
    const averagePrice = utils.computePrice(baseCost, minRAM, value, averageDuration);

    // .. and total cost (exact $)
    const totalCost = utils.computeTotalCost(baseCost, minRAM, value, durations);

    const stats = {
        averagePrice,
        averageDuration,
        totalCost,
        value,
    };

    console.log('Stats: ', stats);
    return stats;
};
