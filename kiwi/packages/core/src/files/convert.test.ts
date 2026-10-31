import { describe, expect, it } from 'vitest';
import { convertUnits, evaluate } from './convert';

describe('evaluate', () => {
  it.each([
    ['1 + 2', 3],
    ['2 + 3 * 4', 14],
    ['(2 + 3) * 4', 20],
    ['10 / 4', 2.5],
    ['2 ^ 3 ^ 2', 512],
    ['-5 + 2', -3],
    ['3 * -2', -6],
    ['10 % 4', 2],
    ['  7  ', 7],
    ['0.1 + 0.2', 0.1 + 0.2],
  ])('%s = %d', (expression, expected) => {
    expect(evaluate(expression)).toBeCloseTo(expected);
  });

  it.each(['', '2 +', '(2 + 3', '2 + 3)', 'abc', '1 / 0', '2 $ 3', 'process.exit()', '1 2'])(
    'rejects %j',
    (expression) => {
      expect(evaluate(expression)).toBeNull();
    },
  );
});

describe('convertUnits', () => {
  it('converts length, mass and volume', () => {
    expect(convertUnits(5, 'km', 'miles')).toBeCloseTo(3.1069, 3);
    expect(convertUnits(1, 'lb', 'g')).toBeCloseTo(453.59, 1);
    expect(convertUnits(2, 'liters', 'cup')).toBeCloseTo(8.4535, 3);
  });

  it('converts temperature', () => {
    expect(convertUnits(100, 'celsius', 'fahrenheit')).toBeCloseTo(212);
    expect(convertUnits(32, 'f', 'c')).toBeCloseTo(0);
    expect(convertUnits(0, 'c', 'k')).toBeCloseTo(273.15);
  });

  it('refuses mismatched or unknown units', () => {
    expect(convertUnits(1, 'km', 'kg')).toBeNull();
    expect(convertUnits(1, 'parsecs', 'm')).toBeNull();
  });
});
