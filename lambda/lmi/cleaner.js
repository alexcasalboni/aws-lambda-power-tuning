'use strict';

const utils = require('./utils');

/**
 * Clean up LMI resources: delete the cloned LMI function,
 * and delete the capacity provider.
 * Supports both single-target cleanup (normal path) and
 * multi-target cleanup (error path with instanceTypeConfigs).
 */
module.exports.handler = async(event, context) => {
    const {lambdaARN, cleanupTargets} = extractCleanupData(event);

    const region = utils.regionFromARN(lambdaARN);

    for (const target of cleanupTargets) {
        // Delete the LMI function
        if (target.lmiFunctionArn) {
            try {
                await utils.deleteLambdaFunction(target.lmiFunctionArn);
                console.log(`Deleted LMI function ${target.lmiFunctionArn}`);
            } catch (error) {
                console.log(`Error deleting LMI function (continuing cleanup): ${error.message}`);
            }
        } else if (target.capacityProviderName) {
            // Try derived function name when ARN is not available (error cleanup path)
            const derivedFnName = `${target.capacityProviderName}-fn`;
            try {
                await utils.deleteLambdaFunction(derivedFnName);
                console.log(`Deleted derived LMI function ${derivedFnName}`);
            } catch (error) {
                console.log(`Error deleting derived function ${derivedFnName} (may not exist): ${error.message}`);
            }
        }

        // Delete the capacity provider
        if (target.capacityProviderName) {
            try {
                await utils.deleteCapacityProvider(target.capacityProviderName, region);
                console.log(`Deleted capacity provider ${target.capacityProviderName}`);
            } catch (error) {
                console.log(`Error deleting capacity provider ${target.capacityProviderName} (may not exist): ${error.message}`);
            }
        }
    }

    return 'OK';
};

const extractCleanupData = (event) => {
    // Multi-instance-type error cleanup: clean ALL capacity providers
    if (event.instanceTypeConfigs) {
        return {
            lambdaARN: event.lambdaARN,
            cleanupTargets: event.instanceTypeConfigs.map(cfg => ({
                capacityProviderName: cfg.capacityProviderName,
                lmiFunctionArn: null,
            })),
        };
    }

    // Single-target cleanup (normal path or single-instance error path)
    const lmiFunctionArn = event.lmiSetup && event.lmiSetup.lmiFunctionArn;
    const cpName = (event.lmiSetup && event.lmiSetup.capacityProviderName) || event.capacityProviderName;
    return {
        lambdaARN: event.lambdaARN,
        cleanupTargets: [{
            lmiFunctionArn,
            capacityProviderName: cpName,
        }],
    };
};
