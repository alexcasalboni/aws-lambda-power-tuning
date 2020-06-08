'use strict';

const sinon = require('sinon');

// hide all logging for tests
// comment out the line which
// you would like to see logged
// during test run
sinon.stub(console, 'log');
sinon.stub(console, 'info');
sinon.stub(console, 'debug');
sinon.stub(console, 'error');
