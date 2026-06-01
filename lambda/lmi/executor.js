'use strict';

const utils = require('./utils');

/**
 * Execute sustained concurrent load for ONE memoryPerVCpu value,
 * ramping through concurrency values with early stopping on degradation.
 */
module.exports.handler = async(event, context) => {
    const {
        lambdaARN,
        memoryPerVCpu,
        concurrencyValues,
        lmiConfig,
        lmiSetup,
    } = extractDataFromInput(event);

    validateInput(lambdaARN, memoryPerVCpu, concurrencyValues);

    const {capacityProviderArn, functionVersion} = lmiSetup;
    const {testDurationSeconds, degradationThreshold, disablePayloadLogs} = lmiConfig;
    const payload = event.input.payload || {};

    // Instance type and cost are resolved by lmi-initializer and passed through lmi-setup
    const instanceType = lmiSetup.instanceType;
    const instanceCostHourly = lmiSetup.instanceCostHourly;

    if (!instanceCostHourly) {
        throw new Error(`Missing instanceCostHourly for ${instanceType}. This should be resolved by lmi-initializer.`);
    }

    // Update function config for this memoryPerVCpu ratio
    console.log(`Configuring memoryPerVCpu=${memoryPerVCpu}`);
    await utils.updateFunctionLmiConfig(lambdaARN, capacityProviderArn, memoryPerVCpu, concurrencyValues[0]);
    await utils.waitForFunctionUpdate(lambdaARN);

    let bestDuration = Infinity;
    let bestConcurrency = concurrencyValues[0];
    const results = [];

    for (const concurrency of concurrencyValues) {
        console.log(`Testing concurrency=${concurrency} with memoryPerVCpu=${memoryPerVCpu}`);

        // Update concurrency setting if not the first value (already set above)
        if (concurrency !== concurrencyValues[0]) {
            await utils.updateFunctionLmiConfig(lambdaARN, capacityProviderArn, memoryPerVCpu, concurrency);
            await utils.waitForFunctionUpdate(lambdaARN);
        }

        // Run sustained concurrent load
        const loadResult = await utils.runSustainedLoad(
            lambdaARN, functionVersion, payload,
            concurrency, testDurationSeconds, disablePayloadLogs,
        );

        if (loadResult.durations.length === 0) {
            console.log(`No successful invocations at concurrency=${concurrency}, stopping ramp`);
            break;
        }

        // Use client-side durations (LMI functions don't support tail logs)
        const durations = loadResult.durations;
        const avgDuration = utils.computeAverageDuration(durations, 0.2);
        const throughput = loadResult.totalInvocations / testDurationSeconds;
        const errorRate = loadResult.errors / loadResult.totalInvocations;

        // Compute LMI per-invocation cost
        const avgPrice = utils.computeLmiPrice(instanceCostHourly, avgDuration, concurrency);
        const totalCost = avgPrice * loadResult.totalInvocations;

        const result = {
            concurrency,
            averageDuration: avgDuration,
            averagePrice: avgPrice,
            totalCost,
            throughput,
            errorRate,
            totalInvocations: loadResult.totalInvocations,
        };
        results.push(result);

        console.log(`concurrency=${concurrency}: avgDuration=${avgDuration.toFixed(2)}ms, ` +
            `avgPrice=${avgPrice.toFixed(10)}, throughput=${throughput.toFixed(1)}/s, ` +
            `errorRate=${(errorRate * 100).toFixed(1)}%`);

        // Track best duration and check for degradation
        if (avgDuration < bestDuration) {
            bestDuration = avgDuration;
            bestConcurrency = concurrency;
        } else if (degradationThreshold != null && avgDuration > bestDuration * (1 + degradationThreshold)) {
            console.log(`Performance degraded at concurrency=${concurrency}: ` +
                `${avgDuration.toFixed(2)}ms > ${bestDuration.toFixed(2)}ms * ${1 + degradationThreshold}. Stopping ramp.`);
            break;
        }
    }

    // Find the best result (lowest duration) for this memoryPerVCpu
    const bestResult = results.find(r => r.concurrency === bestConcurrency) || results[0];

    if (!bestResult) {
        console.log(`No successful results for memoryPerVCpu=${memoryPerVCpu}`);
        return {
            type: 'lmi',
            memoryPerVCpu,
            bestConcurrency: 0,
            instanceType,
            averageDuration: 0,
            averagePrice: 0,
            totalCost: 0,
            value: memoryPerVCpu,
            allResults: [],
        };
    }

    console.log(`Best for memoryPerVCpu=${memoryPerVCpu}: concurrency=${bestConcurrency}, ` +
        `duration=${bestResult.averageDuration.toFixed(2)}ms, price=${bestResult.averagePrice.toFixed(10)}`);

    return {
        type: 'lmi',
        memoryPerVCpu,
        bestConcurrency,
        instanceType,
        averageDuration: bestResult.averageDuration,
        averagePrice: bestResult.averagePrice,
        totalCost: bestResult.totalCost,
        value: memoryPerVCpu, // maps to power field for unified analysis
        allResults: results,
    };
};

const extractDataFromInput = (event) => {
    const input = event.input; // original state machine input
    const lmiSetupResult = event.lmiSetup;
    return {
        lambdaARN: lmiSetupResult.lmiFunctionArn || input.lambdaARN,
        memoryPerVCpu: event.value.memoryPerVCpu,
        concurrencyValues: event.value.concurrencyValues,
        lmiConfig: lmiSetupResult.lmiConfig,
        lmiSetup: {
            capacityProviderArn: lmiSetupResult.capacityProviderArn,
            functionVersion: lmiSetupResult.functionVersion,
            instanceType: lmiSetupResult.instanceType,
            instanceCostHourly: lmiSetupResult.instanceCostHourly,
        },
    };
};

const validateInput = (lambdaARN, memoryPerVCpu, concurrencyValues) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!memoryPerVCpu || isNaN(memoryPerVCpu)) {
        throw new Error('Invalid memoryPerVCpu: ' + memoryPerVCpu);
    }
    if (!concurrencyValues || !concurrencyValues.length) {
        throw new Error('Missing or empty concurrencyValues');
    }
};
