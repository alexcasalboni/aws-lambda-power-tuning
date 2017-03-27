'use strict';

/**
 * Compute cost and estimate best configuration.
 */

module.exports.handler = (event, context, callback) => {
  
  const powerValues = process.env.powerValues.split(',');

  callback(null, "OK");

};
