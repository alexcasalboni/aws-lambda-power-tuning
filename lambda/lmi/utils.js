'use strict';

const {
    CreateCapacityProviderCommand, CreateFunctionCommand,
    DeleteCapacityProviderCommand, GetCapacityProviderCommand,
    GetFunctionCommand, GetFunctionScalingConfigCommand,
    InvokeCommand, LambdaClient, PutFunctionScalingConfigCommand,
    UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');
const { PricingClient, GetProductsCommand } = require('@aws-sdk/client-pricing');

const utils = require('../utils');

const lmiUtils = module.exports;

// Re-export shared utils that LMI lambdas need
module.exports.regionFromARN = utils.regionFromARN;
module.exports.lambdaClientFromARN = utils.lambdaClientFromARN;
module.exports.waitForFunctionUpdate = utils.waitForFunctionUpdate;
module.exports.publishLambdaVersion = utils.publishLambdaVersion;
module.exports.getLambdaConfig = utils.getLambdaConfig;
module.exports.deleteLambdaFunction = utils.deleteLambdaFunction;
module.exports.computeAverageDuration = utils.computeAverageDuration;
module.exports.convertPayload = utils.convertPayload;
module.exports.range = utils.range;
module.exports.sleep = utils.sleep;

// AWS Pricing API is available in these regions
const PRICING_API_REGIONS = ['us-east-1', 'ap-south-1', 'eu-central-1'];

// LMI management fee percentage on top of EC2 cost
const LMI_MANAGEMENT_FEE = 0.15;
// LMI request cost per invocation
const LMI_REQUEST_COST = 0.0000002; // $0.20 per million

module.exports.LMI_MANAGEMENT_FEE = LMI_MANAGEMENT_FEE;
module.exports.LMI_REQUEST_COST = LMI_REQUEST_COST;

module.exports.LMI_DEFAULTS = {
    memoryPerVCpuValues: [2.0, 4.0, 6.0, 8.0],
    concurrencyValues: [1, 2, 5, 10, 20, 50, 100],
    testDurationSeconds: 60,
    degradationThreshold: null,
    instanceTypes: ['c8g.xlarge'],
    architecture: 'arm64',
};

module.exports.retryWithBackoff = async(fn, maxRetries, initialDelayMs) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = initialDelayMs * Math.pow(2, attempt);
                console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
                await lmiUtils.sleep(delay);
            }
        }
    }
    throw lastError;
};

module.exports.createCapacityProvider = async(name, region, vpcConfig, instanceRequirements, operatorRoleArn) => {
    console.log('Creating capacity provider:', name);
    const lambda = new LambdaClient({region});
    const params = {
        CapacityProviderName: name,
        VpcConfig: {
            SubnetIds: vpcConfig.subnetIds,
            SecurityGroupIds: vpcConfig.securityGroupIds,
        },
        PermissionsConfig: {
            CapacityProviderOperatorRoleArn: operatorRoleArn,
        },
    };

    if (instanceRequirements) {
        params.InstanceRequirements = {};
        if (instanceRequirements.architectures) {
            params.InstanceRequirements.Architectures = instanceRequirements.architectures;
        }
        if (instanceRequirements.allowedInstanceTypes) {
            params.InstanceRequirements.AllowedInstanceTypes = instanceRequirements.allowedInstanceTypes;
        }
        if (instanceRequirements.excludedInstanceTypes) {
            params.InstanceRequirements.ExcludedInstanceTypes = instanceRequirements.excludedInstanceTypes;
        }
    }

    return lambda.send(new CreateCapacityProviderCommand(params));
};

module.exports.getCapacityProvider = async(name, region) => {
    console.log('Getting capacity provider:', name);
    const lambda = new LambdaClient({region});
    return lambda.send(new GetCapacityProviderCommand({CapacityProviderName: name}));
};

module.exports.deleteCapacityProvider = async(name, region) => {
    console.log('Deleting capacity provider:', name);
    const lambda = new LambdaClient({region});
    try {
        return await lambda.send(new DeleteCapacityProviderCommand({CapacityProviderName: name}));
    } catch (error) {
        if (error.name === 'ResourceNotFoundException') {
            console.log('Capacity provider already deleted or not found:', name);
            return null;
        }
        throw error;
    }
};

module.exports.waitForCapacityProviderActive = async(name, region, maxWaitMs = 600000) => {
    console.log(`Waiting for capacity provider ${name} to become ACTIVE (max ${maxWaitMs}ms)`);
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitMs) {
        const result = await lmiUtils.getCapacityProvider(name, region);
        const cp = result.CapacityProvider || result;
        const state = cp.State;
        console.log(`Capacity provider ${name} state: ${state}`);

        if (state === 'Active') {
            return cp;
        }
        if (state === 'Failed') {
            throw new Error(`Capacity provider ${name} entered Failed state`);
        }

        await lmiUtils.sleep(pollInterval);
    }

    throw new Error(`Timeout waiting for capacity provider ${name} to become ACTIVE after ${maxWaitMs}ms`);
};

module.exports.createLmiFunction = async(sourceLambdaARN, newFunctionName, capacityProviderArn, memoryPerVCpu, concurrency) => {
    console.log(`Creating LMI function ${newFunctionName} from ${sourceLambdaARN}`);
    const lambda = lmiUtils.lambdaClientFromARN(sourceLambdaARN);

    const sourceFunc = await lambda.send(new GetFunctionCommand({FunctionName: sourceLambdaARN}));
    const sourceConfig = sourceFunc.Configuration;
    const sourceCode = sourceFunc.Code;

    const params = {
        FunctionName: newFunctionName,
        Role: sourceConfig.Role,
        Handler: sourceConfig.Handler,
        Runtime: sourceConfig.Runtime,
        Timeout: sourceConfig.Timeout,
        MemorySize: Math.max(sourceConfig.MemorySize, memoryPerVCpu * 1024),
        Description: `LMI power tuning clone of ${sourceLambdaARN}`,
        Architectures: sourceConfig.Architectures,
        Code: {
            S3Bucket: sourceCode.RepositoryType === 'S3' ? sourceCode.Location.split('/')[2].split('.')[0] : undefined,
        },
        CapacityProviderConfig: {
            LambdaManagedInstancesCapacityProviderConfig: {
                CapacityProviderArn: capacityProviderArn,
                ExecutionEnvironmentMemoryGiBPerVCpu: memoryPerVCpu,
                PerExecutionEnvironmentMaxConcurrency: concurrency,
            },
        },
    };

    if (sourceConfig.Environment) {
        params.Environment = sourceConfig.Environment;
    }

    if (sourceConfig.Layers) {
        params.Layers = sourceConfig.Layers.map(l => l.Arn);
    }

    const response = await fetch(sourceCode.Location);
    const zipBuffer = Buffer.from(await response.arrayBuffer());
    params.Code = {ZipFile: zipBuffer};

    const result = await lambda.send(new CreateFunctionCommand(params));
    console.log(`Created LMI function: ${result.FunctionArn}`);
    return result.FunctionArn;
};

module.exports.updateFunctionLmiConfig = async(lambdaARN, capacityProviderArn, memoryPerVCpu, concurrency) => {
    console.log(`Updating LMI config: memoryPerVCpu=${memoryPerVCpu}, concurrency=${concurrency}`);
    const params = {
        FunctionName: lambdaARN,
        MemorySize: memoryPerVCpu * 1024,
        CapacityProviderConfig: {
            LambdaManagedInstancesCapacityProviderConfig: {
                CapacityProviderArn: capacityProviderArn,
                ExecutionEnvironmentMemoryGiBPerVCpu: memoryPerVCpu,
                PerExecutionEnvironmentMaxConcurrency: concurrency,
            },
        },
    };
    const lambda = lmiUtils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new UpdateFunctionConfigurationCommand(params));
};

module.exports.putFunctionScalingConfig = async(lambdaARN, qualifier, minEnvs, maxEnvs) => {
    console.log(`Setting scaling config: min=${minEnvs}, max=${maxEnvs} for qualifier=${qualifier}`);
    const lambda = lmiUtils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new PutFunctionScalingConfigCommand({
        FunctionName: lambdaARN,
        Qualifier: qualifier,
        ScalingConfig: {
            MinimumExecutionEnvironments: minEnvs,
            MaximumExecutionEnvironments: maxEnvs,
        },
    }));
};

module.exports.getFunctionScalingConfig = async(lambdaARN, qualifier) => {
    console.log(`Getting scaling config for qualifier=${qualifier}`);
    const lambda = lmiUtils.lambdaClientFromARN(lambdaARN);
    return lambda.send(new GetFunctionScalingConfigCommand({
        FunctionName: lambdaARN,
        Qualifier: qualifier,
    }));
};

module.exports.computeLmiPrice = (instanceCostHourly, avgDurationMs, effectiveConcurrency) => {
    const computeCostPerSecond = instanceCostHourly * (1 + LMI_MANAGEMENT_FEE) / 3600;
    const durationSeconds = avgDurationMs / 1000;
    const perInvocationCost = (computeCostPerSecond * durationSeconds) / effectiveConcurrency;
    return perInvocationCost + LMI_REQUEST_COST;
};

module.exports.fetchInstancePricing = async(instanceType, region) => {
    const pricingRegion = PRICING_API_REGIONS.includes(region)
        ? region
        : PRICING_API_REGIONS[0];

    const client = new PricingClient({region: pricingRegion});

    const result = await client.send(new GetProductsCommand({
        ServiceCode: 'AmazonEC2',
        Filters: [
            {Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType},
            {Type: 'TERM_MATCH', Field: 'regionCode', Value: region},
            {Type: 'TERM_MATCH', Field: 'operatingSystem', Value: 'Linux'},
            {Type: 'TERM_MATCH', Field: 'tenancy', Value: 'Shared'},
            {Type: 'TERM_MATCH', Field: 'preInstalledSw', Value: 'NA'},
            {Type: 'TERM_MATCH', Field: 'capacitystatus', Value: 'Used'},
        ],
        MaxResults: 1,
    }));

    if (!result.PriceList || result.PriceList.length === 0) {
        throw new Error(`No pricing found for instance type ${instanceType} in region ${region}`);
    }

    const priceData = JSON.parse(result.PriceList[0]);
    const onDemandTerms = priceData.terms && priceData.terms.OnDemand;
    if (!onDemandTerms) {
        throw new Error(`No on-demand pricing found for ${instanceType} in ${region}`);
    }

    const offerTerm = Object.values(onDemandTerms)[0];
    const priceDimension = Object.values(offerTerm.priceDimensions)[0];
    const pricePerHour = parseFloat(priceDimension.pricePerUnit.USD);

    if (isNaN(pricePerHour) || pricePerHour <= 0) {
        throw new Error(`Invalid price for ${instanceType} in ${region}: ${priceDimension.pricePerUnit.USD}`);
    }

    console.log(`Fetched pricing for ${instanceType} in ${region}: $${pricePerHour}/hr`);
    return pricePerHour;
};

module.exports.runSustainedLoad = async(lambdaARN, qualifier, payload, concurrency, durationSeconds, disablePayloadLogs) => {
    console.log(`Running sustained load: concurrency=${concurrency}, duration=${durationSeconds}s`);

    const convertedPayload = lmiUtils.convertPayload(payload);
    const endTime = Date.now() + (durationSeconds * 1000);
    let totalErrors = 0;
    let totalInvocations = 0;

    const allDurations = [];

    const lambda = lmiUtils.lambdaClientFromARN(lambdaARN);
    const invokeParams = {
        FunctionName: lambdaARN,
        Qualifier: qualifier,
        Payload: convertedPayload,
    };

    const worker = async(workerId) => {
        const workerDurations = [];
        let workerErrors = 0;
        let workerInvocations = 0;

        while (Date.now() < endTime) {
            try {
                const start = Date.now();
                const result = await lambda.send(new InvokeCommand(invokeParams));
                const durationMs = Date.now() - start;
                workerInvocations++;

                if (result.FunctionError) {
                    workerErrors++;
                } else {
                    workerDurations.push(durationMs);
                }
            } catch (error) {
                workerErrors++;
                workerInvocations++;
                if (workerErrors <= 3) {
                    console.log(`Worker ${workerId} invocation error: ${error.message}`);
                }
                await lmiUtils.sleep(100);
            }
        }

        return { durations: workerDurations, errors: workerErrors, invocations: workerInvocations };
    };

    const workers = lmiUtils.range(concurrency).map((_, i) => worker(i));
    const workerOutputs = await Promise.all(workers);

    for (const output of workerOutputs) {
        allDurations.push(...output.durations);
        totalErrors += output.errors;
        totalInvocations += output.invocations;
    }

    console.log(`Sustained load complete: ${totalInvocations} invocations, ${totalErrors} errors, ${allDurations.length} successful`);

    return {
        durations: allDurations,
        errors: totalErrors,
        totalInvocations: totalInvocations,
    };
};

module.exports.generateCapacityProviderName = (lambdaARN, instanceType) => {
    const functionName = lambdaARN.split(':').pop();
    const timestamp = Date.now();
    const instanceSuffix = instanceType ? `-${instanceType.replace(/\./g, '')}` : '';
    const baseName = `pt-${functionName}${instanceSuffix}`.substring(0, 120);
    return `${baseName}-${timestamp}`;
};
