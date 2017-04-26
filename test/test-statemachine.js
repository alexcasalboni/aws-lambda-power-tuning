const expect = require('expect.js');
const fs = require('fs');

describe('State Machine Generation', function() {

    describe('template.json', function() {
        it('should be valid json', function() {
            const template = fs.readFileSync('statemachine/template.json', 'utf8');
            const json = JSON.parse(template);
            expect(template).to.be.a('string');
            expect(json).to.be.an('object');
            expect(json.StartAt).to.be.a('string');
            expect(json.States).to.be.an('object');
        });
    });

    describe('template-branch.json', function() {
        it('should be valid json', function() {
            const template = fs.readFileSync('statemachine/template-branch.json', 'utf8');
            const json = JSON.parse(template);
            expect(template).to.be.a('string');
            expect(json).to.be.an('object');
            expect(json.StartAt).to.be.a('string');
            expect(json.States).to.be.an('object');
        });
    });

    describe('generate.js', function() {
        // TODO test script or export functions
    });

});