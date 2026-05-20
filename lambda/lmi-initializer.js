'use strict';

const utils = require('./utils');

/**
 * Validate and prepare the LMI test matrix.
 * Generates configurations for each instance type and memoryPerVCpu value to be tested.
 * Fetches EC2 on-demand pricing from the AWS Pricing API for instance types
 * that don't have a user-provided instanceCostHourly.
 */
module.exports.handler = async(event, context) => {
    const {lambdaARN, lmiConfig} = extractDataFromInput(event);

    validateInput(lambdaARN, lmiConfig);

    const config = applyDefaults(lmiConfig);

    // Normalize instanceTypes: support both string and object formats
    const normalizedInstanceTypes = normalizeInstanceTypes(config.instanceTypes);

    // Build the test matrix: one entry per memoryPerVCpu value
    const lmiTestMatrix = config.memoryPerVCpuValues.map(memoryPerVCpu => ({
        memoryPerVCpu,
        concurrencyValues: config.concurrencyValues,
    }));

    // Fetch pricing for instance types that need it
    const region = utils.regionFromARN(lambdaARN);
    const instanceTypeConfigs = await buildInstanceTypeConfigs(
        normalizedInstanceTypes, lambdaARN, region, lmiTestMatrix,
    );

    console.log(`LMI test matrix: ${instanceTypeConfigs.length} instance types x ${lmiTestMatrix.length} memory ratios x up to ${config.concurrencyValues.length} concurrency values`);

    return {
        instanceTypeConfigs,
        lmiConfig: config,
        lambdaARN,
    };
};

/**
 * Normalize instanceTypes to always be an array of objects.
 * Supports: ["c8g.xlarge"] or [{instanceType: "c8g.xlarge", instanceCostHourly: 0.14}]
 * or mixed: ["c8g.xlarge", {instanceType: "m7g.xlarge", instanceCostHourly: 0.16}]
 */
const normalizeInstanceTypes = (instanceTypes) => {
    return instanceTypes.map(entry => {
        if (typeof entry === 'string') {
            return {instanceType: entry};
        }
        return entry;
    });
};

/**
 * Build per-instance-type configs, fetching pricing from the AWS Pricing API
 * for any instance types that don't have a user-provided instanceCostHourly.
 */
const buildInstanceTypeConfigs = async(normalizedInstanceTypes, lambdaARN, region, lmiTestMatrix) => {
    const configs = [];
    for (const entry of normalizedInstanceTypes) {
        const {instanceType} = entry;
        const capacityProviderName = utils.generateCapacityProviderName(lambdaARN, instanceType);

        let instanceCostHourly = entry.instanceCostHourly;
        if (!instanceCostHourly) {
            console.log(`Fetching pricing for ${instanceType} in ${region} from AWS Pricing API...`);
            instanceCostHourly = await utils.fetchInstancePricing(instanceType, region);
        }

        configs.push({
            instanceType,
            capacityProviderName,
            lmiTestMatrix,
            instanceCostHourly,
        });
    }
    return configs;
};

const extractDataFromInput = (event) => {
    return {
        lambdaARN: event.lambdaARN,
        lmiConfig: event.lmiConfig,
    };
};

const validateInput = (lambdaARN, lmiConfig) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!lmiConfig) {
        throw new Error('Missing lmiConfig');
    }
    if (!lmiConfig.vpcConfig) {
        throw new Error('Missing lmiConfig.vpcConfig');
    }
    if (!lmiConfig.vpcConfig.subnetIds || !lmiConfig.vpcConfig.subnetIds.length) {
        throw new Error('Missing or empty lmiConfig.vpcConfig.subnetIds');
    }
    if (!lmiConfig.vpcConfig.securityGroupIds || !lmiConfig.vpcConfig.securityGroupIds.length) {
        throw new Error('Missing or empty lmiConfig.vpcConfig.securityGroupIds');
    }
    if (!lmiConfig.operatorRoleArn) {
        throw new Error('Missing lmiConfig.operatorRoleArn');
    }
};

const applyDefaults = (lmiConfig) => {
    const defaults = utils.LMI_DEFAULTS;
    return {
        vpcConfig: lmiConfig.vpcConfig,
        operatorRoleArn: lmiConfig.operatorRoleArn,
        instanceTypes: lmiConfig.instanceTypes || defaults.instanceTypes,
        architecture: lmiConfig.architecture || defaults.architecture,
        memoryPerVCpuValues: lmiConfig.memoryPerVCpuValues || defaults.memoryPerVCpuValues,
        concurrencyValues: lmiConfig.concurrencyValues || defaults.concurrencyValues,
        testDurationSeconds: lmiConfig.testDurationSeconds || defaults.testDurationSeconds,
        degradationThreshold: (typeof lmiConfig.degradationThreshold !== 'undefined')
            ? lmiConfig.degradationThreshold : defaults.degradationThreshold,
    };
};
