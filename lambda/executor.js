'use strict';

/**
 * Execute given function N times in parallel, until every invokation is over.
 */
module.exports.handler = (event, context, callback) => {
  
  const powerValues = process.env.powerValues.split(',');

  callback(null, "OK");

};
