'use strict';

const powerValues = process.env.powerValues.split(',');

/**
 * Receive avg prices and decides which config works better.
 */
module.exports.handler = (event, context, callback) => {
  
    const prices = event.prices;  // array?

    // TBD will prices be an object or a list?

    callback(null, "OK");

};
