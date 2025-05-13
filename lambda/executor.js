'use strict';

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM, 10);

/**
 * Execute the given function N times in series or in parallel.
 * Then compute execution statistics (average cost and duration).
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
        discardTopBottom,
        onlyColdStarts,
        sleepBetweenRunsMs,
        disablePayloadLogs,
        allowedExceptions,
    } = await extractDataFromInput(event);

    validateInput(lambdaARN, value, num); // may throw

    // force only 1 execution if dryRun
    if (dryRun) {
        console.log('[Dry-run] forcing num=1');
        num = 1;
    }

    const lambdaAlias = 'RAM' + value;
    let results;

    // defaulting the index to 0 as the index is required for onlyColdStarts
    let aliasToInvoke = utils.buildAliasString(lambdaAlias, onlyColdStarts, 0);
    // We need the architecture, regardless of onlyColdStarts or not
    const {architecture, isPending} = await utils.getLambdaConfig(lambdaARN, aliasToInvoke);

    console.log(`Detected architecture type: ${architecture}, isPending: ${isPending}`);

    // pre-generate an array of N payloads
    const payloads = utils.generatePayloads(num, payload);

    const runInput = {
        num: num,
        lambdaARN: lambdaARN,
        lambdaAlias: lambdaAlias,
        payloads: payloads,
        preARN: preProcessorARN,
        postARN: postProcessorARN,
        onlyColdStarts: onlyColdStarts,
        sleepBetweenRunsMs: sleepBetweenRunsMs,
        disablePayloadLogs: disablePayloadLogs,
        allowedExceptions: allowedExceptions,
    };

    // wait if the function/alias state is Pending
    // in the case of onlyColdStarts, we will verify each alias in the runInParallel or runInSeries
    if (isPending && !onlyColdStarts) {
        await utils.waitForAliasActive(lambdaARN, lambdaAlias);
        console.log('Alias active');
    }

    if (enableParallel) {
        results = await runInParallel(runInput);
    } else {
        results = await runInSeries(runInput);
    }

    // get base cost for Lambda
    const baseCost = utils.lambdaBaseCost(utils.regionFromARN(lambdaARN), architecture);

    return computeStatistics(baseCost, results, value, discardTopBottom);
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


const extractDiscardTopBottomValue = (event) => {
    // extract discardTopBottom used to trim values from average duration
    let discardTopBottom = event.discardTopBottom;
    if (typeof discardTopBottom === 'undefined') {
        // default value for discardTopBottom
        discardTopBottom = 0.2;
    }
    // In case of onlyColdStarts, we only have 1 invocation per alias, therefore we shouldn't discard any execution
    if (event.onlyColdStarts){
        discardTopBottom = 0;
        console.log('Setting discardTopBottom to 0, every invocation should be accounted when onlyColdStarts');
    }
    // discardTopBottom must be between 0 and 0.4
    return Math.min(Math.max(discardTopBottom, 0.0), 0.4);
};

const extractSleepTime = (event) => {
    let sleepBetweenRunsMs = event.sleepBetweenRunsMs;
    if (isNaN(sleepBetweenRunsMs)) {
        sleepBetweenRunsMs = 0;
    } else {
        sleepBetweenRunsMs = parseInt(sleepBetweenRunsMs, 10);
    }
    return sleepBetweenRunsMs;
};

const extractDataFromInput = async(event) => {
    const input = event.input; // original state machine input
    const payload = await extractPayloadValue(input);
    const discardTopBottom = extractDiscardTopBottomValue(input);
    const sleepBetweenRunsMs = extractSleepTime(input);
    return {
        value: parseInt(event.value, 10),
        lambdaARN: input.lambdaARN,
        num: parseInt(input.num, 10),
        enableParallel: !!input.parallelInvocation,
        payload: payload,
        dryRun: input.dryRun === true,
        preProcessorARN: input.preProcessorARN,
        postProcessorARN: input.postProcessorARN,
        discardTopBottom: discardTopBottom,
        onlyColdStarts: !!input.onlyColdStarts,
        sleepBetweenRunsMs: sleepBetweenRunsMs,
        disablePayloadLogs: !!input.disablePayloadLogs,
        allowedExceptions: input.allowedExceptions
    };
};

const runInParallel = async({num, lambdaARN, lambdaAlias, payloads, preARN, postARN, disablePayloadLogs, onlyColdStarts, allowedExceptions = []}) => {
    const results = [];
    // run all invocations in parallel ...
    const invocations = utils.range(num).map(async(_, i) => {
        let aliasToInvoke = utils.buildAliasString(lambdaAlias, onlyColdStarts, i);
        if (onlyColdStarts){
            await utils.waitForAliasActive(lambdaARN, aliasToInvoke);
            console.log(`${aliasToInvoke} is active`);
        }
        const {invocationResults, actualPayload} = await utils.invokeLambdaWithProcessors(lambdaARN, aliasToInvoke, payloads[i], preARN, postARN, disablePayloadLogs);
        const parsedResults = JSON.parse(Buffer.from(invocationResults.Payload));
        // invocation errors return 200 and contain FunctionError and Payload
        if ((invocationResults.FunctionError) && (allowedExceptions.includes(parsedResults.errorType))) {
            console.log(`Error ${parsedResults.errorType} is in the allowedExceptions list: ${allowedExceptions}`);
        } else if (invocationResults.FunctionError) {
            let errorMessage = 'Invocation error (running in parallel)';
            utils.handleLambdaInvocationError(errorMessage, invocationResults, actualPayload, disablePayloadLogs);
        }
        results.push(invocationResults);
    });
    // ... and wait for results
    await Promise.all(invocations);
    return results;
};

const runInSeries = async({num, lambdaARN, lambdaAlias, payloads, preARN, postARN, sleepBetweenRunsMs, disablePayloadLogs, onlyColdStarts, allowedExceptions = []}) => {
    const results = [];
    for (let i = 0; i < num; i++) {
        let aliasToInvoke = utils.buildAliasString(lambdaAlias, onlyColdStarts, i);
        // run invocations in series
        if (onlyColdStarts){
            await utils.waitForAliasActive(lambdaARN, aliasToInvoke);
            console.log(`${aliasToInvoke} is active`);
        }
        const {invocationResults, actualPayload} = await utils.invokeLambdaWithProcessors(lambdaARN, aliasToInvoke, payloads[i], preARN, postARN, disablePayloadLogs, allowedExceptions);
        const parsedResults = JSON.parse(Buffer.from(invocationResults.Payload));
        // invocation errors return 200 and contain FunctionError and Payload
        if ((invocationResults.FunctionError) && (allowedExceptions.includes(parsedResults.errorType))) {
            console.log(`Error ${parsedResults.errorType} is in the allowedExceptions list: ${allowedExceptions}`);
        } else if (invocationResults.FunctionError) {
            let errorMessage = 'Invocation error (running in series)';
            utils.handleLambdaInvocationError(errorMessage, invocationResults, actualPayload, disablePayloadLogs);
        }
        if (sleepBetweenRunsMs > 0) {
            await utils.sleep(sleepBetweenRunsMs);
        }
        results.push(invocationResults);
    }
    return results;
};

const computeStatistics = (baseCost, results, value, discardTopBottom) => {

    // use results (which include logs) to compute average duration ...
    const totalDurations = utils.parseLogAndExtractDurations(results);
    const averageDuration = utils.computeAverageDuration(totalDurations, discardTopBottom);
    console.log('Average duration: ', averageDuration);

    // ... and overall cost statistics
    const billedDurations = utils.parseLogAndExtractBilledDurations(results);
    const averageBilledDuration = utils.computeAverageDuration(billedDurations, discardTopBottom);
    console.log('Average Billed duration: ', averageBilledDuration);
    const averagePrice = utils.computePrice(baseCost, minRAM, value, averageBilledDuration);
    // .. and total cost (exact $)
    const totalCost = utils.computeTotalCost(baseCost, minRAM, value, billedDurations);

    const stats = {
        averagePrice,
        averageDuration,
        totalCost,
        value,
    };

    console.log('Stats: ', stats);
    return stats;
};
