'use strict';

const utils = require('./utils');

/**
 * Create a capacity provider, create a new LMI-enabled function cloned from the source,
 * and publish a version. Does NOT wait for the version to be ready — that happens
 * in a Step Functions polling loop via lmi-ready.
 */
module.exports.handler = async(event, context) => {
    const {lambdaARN, lmiConfig, instanceTypeConfig} = event;

    validateInput(lambdaARN, lmiConfig, instanceTypeConfig);

    const region = utils.regionFromARN(lambdaARN);
    const {instanceType, capacityProviderName, instanceCostHourly} = instanceTypeConfig;

    // Step 1: Create the capacity provider
    console.log(`Creating capacity provider ${capacityProviderName} with instance type ${instanceType}`);
    await utils.createCapacityProvider(
        capacityProviderName,
        region,
        lmiConfig.vpcConfig,
        {
            architectures: [lmiConfig.architecture],
            allowedInstanceTypes: [instanceType],
        },
        lmiConfig.operatorRoleArn,
    );

    // Step 2: Wait for capacity provider to become ACTIVE
    const cpResult = await utils.waitForCapacityProviderActive(capacityProviderName, region);
    const capacityProviderArn = cpResult.Arn || cpResult.CapacityProviderArn;
    console.log(`Capacity provider ACTIVE: ${capacityProviderArn}`);

    // Step 3: Create a new LMI function cloned from the source with capacity provider attached
    const lmiFunctionName = `${capacityProviderName}-fn`;
    const initialMemoryPerVCpu = lmiConfig.memoryPerVCpuValues[0];
    const initialConcurrency = lmiConfig.concurrencyValues[0];
    const lmiFunctionArn = await utils.createLmiFunction(
        lambdaARN, lmiFunctionName, capacityProviderArn,
        initialMemoryPerVCpu, initialConcurrency,
    );
    await utils.waitForFunctionUpdate(lmiFunctionArn);

    // Step 4: Publish a function version
    const {Version} = await utils.publishLambdaVersion(lmiFunctionArn);
    console.log(`Published function version: ${Version}`);

    return {
        capacityProviderName,
        capacityProviderArn,
        lmiFunctionArn,
        functionVersion: Version,
        lmiConfig,
        lambdaARN,
        instanceType,
        instanceCostHourly,
    };
};

const validateInput = (lambdaARN, lmiConfig, instanceTypeConfig) => {
    if (!lambdaARN) {
        throw new Error('Missing or empty lambdaARN');
    }
    if (!lmiConfig) {
        throw new Error('Missing lmiConfig');
    }
    if (!instanceTypeConfig) {
        throw new Error('Missing instanceTypeConfig');
    }
    if (!instanceTypeConfig.instanceType) {
        throw new Error('Missing instanceTypeConfig.instanceType');
    }
    if (!instanceTypeConfig.capacityProviderName) {
        throw new Error('Missing instanceTypeConfig.capacityProviderName');
    }
};
