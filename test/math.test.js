const { expect } = require('chai');
const { add } = require('../math');

describe('Math Functions', () => {
    it('should return the sum of two numbers', () => {
        const result = add(2, 3);
        expect(result).to.equal(5);
    });
});
