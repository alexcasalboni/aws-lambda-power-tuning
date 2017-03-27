'use strict';

/**
 * Initialize versions & aliases for next branches.
 */
module.exports.handler = (event, context, callback) => {
  
  const powerValues = process.env.powerValues.split(',');

  callback(null, "OK");

};
