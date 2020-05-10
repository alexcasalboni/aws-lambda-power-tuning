'use strict';

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM, 10);

/**
 * Execute the given function N times in series or in parallel.
 * Then compute execution statistics (averate cost and duration).
 */
module.exports.handler = async(event, context) => {
    // read input from event
    let {lambdaARN, value, num, enableParallel, payload, dryRun} = extractDataFromInput(event);

    validateInput(lambdaARN, value, num); // may throw

    // force only 1 execution if dryRun
    if (dryRun) {
        console.log('[Dry-run] forcing num=1');
        num = 1;
    }

    const lambdaAlias = 'RAM' + value;
    let results;

    // pre-generate an array of N payloads
    const payloads = generatePayloads(num, payload);

    if (enableParallel) {
        results = await runInParallel(num, lambdaARN, lambdaAlias, payloads);
    } else {
        results = await runInSeries(num, lambdaARN, lambdaAlias, payloads);
    }

    // get base cost
    const prices = JSON.parse(process.env.baseCosts);
    const baseCost = utils.baseCostForRegion(prices, utils.regionFromARN(lambdaARN));

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

const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        value: parseInt(event.value, 10),
        num: parseInt(event.num, 10),
        enableParallel: !!event.parallelInvocation,
        payload: event.payload,
        dryRun: event.dryRun === true,
    };
};

const generatePayloads = (num, payloadInput) => {
    if (Array.isArray(payloadInput)) {
        // if array, generate a list of payloads based on weights

        // fail if empty list or missing weight/payload
        if (payloadInput.length === 0 || payloadInput.some(p => !p.weight || !p.payload)) {
            throw new Error('Invalid weighted payload structure');
        }

        // we use relative weights (not %), so here we compute the total weight
        const total = payloadInput.map(p => p.weight).reduce((a, b) => a + b, 0);

        // generate an array of num items (to be filled)
        const payloads = utils.range(num);

        // iterate over weighted payloads and fill the array based on relative weight
        let done = 0;
        for (let p of payloadInput) {
            const howMany = Math.floor(p.weight * num / total);
            if (howMany < 1) {
                throw new Error('Invalid payload weight (num is too small)');
            }
            payloads.fill(convertPayload(p.payload), done, done + howMany);
            done += howMany;
        }

        return payloads;

    } else {
        // if not an array, always use the same payload (still generate a list)
        const payloads = utils.range(num);
        payloads.fill(convertPayload(payloadInput), 0, num);
        return payloads;
    }
};

const convertPayload = (payload) => {
    // optionally convert everything into string
    if (typeof payload !== 'string' && typeof payload !== 'undefined') {
        console.log('Converting payload to string from ', typeof payload);
        payload = JSON.stringify(payload);
    }
    return payload;
};

const runInParallel = async(num, lambdaARN, lambdaAlias, payloads) => {
    const results = [];
    // run all invocations in parallel ...
    const invocations = utils.range(num).map(async(_, i) => {
        const data = await utils.invokeLambda(lambdaARN, lambdaAlias, payloads[i]);
        // invocation errors return 200 and contain FunctionError and Payload
        if (data.FunctionError) {
            throw new Error('Invocation error: ' + data.Payload);
        }
        results.push(data);
    });
    // ... and wait for results
    await Promise.all(invocations);
    return results;
};

const runInSeries = async(num, lambdaARN, lambdaAlias, payloads) => {
    const results = [];
    for (let i = 0; i < num; i++) {
        // run invocations in series
        const data = await utils.invokeLambda(lambdaARN, lambdaAlias, payloads[i]);
        // invocation errors return 200 and contain FunctionError and Payload
        if (data.FunctionError) {
            throw new Error('Invocation error: ' + data.Payload);
        }
        results.push(data);
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
