'use strict';

const powerValues = process.env.powerValues.split(',');

/**
 * Receive avg prices and decides which config works better.
 */
module.exports.handler = (event, context, callback) => {
  
    const prices = event.map(function(record) {
        return {
            'value': record.value,
            'price': record.price
        }
    });

    console.log(prices);

    // TBD compute best price and return corresponding value as result

    callback(null, "OK");

};
