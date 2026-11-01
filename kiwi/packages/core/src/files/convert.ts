/** Deterministic arithmetic and unit conversion. The model never does maths. */

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string };

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 3,
  neg: 4,
};

function tokenize(expression: string): Token[] | null {
  const tokens: Token[] = [];
  const pattern = /\s*(\d+(?:\.\d+)?|[-+*/^%()])/y;
  let index = 0;
  while (index < expression.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(expression);
    if (!match?.[1]) return expression.slice(index).trim() === '' ? tokens : null;
    index = pattern.lastIndex;
    const text = match[1];
    const previous = tokens.at(-1);
    const startsOperand = !previous || (previous.kind === 'op' && previous.value !== ')');
    if (/\d/.test(text)) tokens.push({ kind: 'num', value: Number(text) });
    else tokens.push({ kind: 'op', value: text === '-' && startsOperand ? 'neg' : text });
  }
  return tokens;
}

function toPostfix(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const stack: string[] = [];
  for (const token of tokens) {
    if (token.kind === 'num') output.push(token);
    else if (token.value === '(') stack.push('(');
    else if (token.value === ')') {
      while (stack.length > 0 && stack.at(-1) !== '(')
        output.push({ kind: 'op', value: stack.pop() ?? '' });
      if (stack.pop() !== '(') return null;
    } else {
      const rightAssociative = token.value === '^' || token.value === 'neg';
      while (stack.length > 0 && stack.at(-1) !== '(') {
        const top = stack.at(-1) ?? '';
        const higher = (PRECEDENCE[top] ?? 0) > (PRECEDENCE[token.value] ?? 0);
        const equal = PRECEDENCE[top] === PRECEDENCE[token.value] && !rightAssociative;
        if (!higher && !equal) break;
        output.push({ kind: 'op', value: stack.pop() ?? '' });
      }
      stack.push(token.value);
    }
  }
  while (stack.length > 0) {
    const op = stack.pop() ?? '';
    if (op === '(') return null;
    output.push({ kind: 'op', value: op });
  }
  return output;
}

function applyOperator(op: string, stack: number[]): boolean {
  const b = stack.pop();
  if (b === undefined) return false;
  if (op === 'neg') {
    stack.push(-b);
    return true;
  }
  const a = stack.pop();
  if (a === undefined) return false;
  const results: Record<string, number> = {
    '+': a + b,
    '-': a - b,
    '*': a * b,
    '/': a / b,
    '%': a % b,
    '^': a ** b,
  };
  const value = results[op];
  if (value === undefined) return false;
  stack.push(value);
  return true;
}

/** Returns the value, or null when the expression is not plain arithmetic. */
export function evaluate(expression: string): number | null {
  const tokens = tokenize(expression);
  const postfix = tokens && toPostfix(tokens);
  if (!postfix || postfix.length === 0) return null;
  const stack: number[] = [];
  for (const token of postfix) {
    if (token.kind === 'num') stack.push(token.value);
    else if (!applyOperator(token.value, stack)) return null;
  }
  const [result] = stack;
  return stack.length === 1 && result !== undefined && Number.isFinite(result) ? result : null;
}

interface Dimension {
  /** Unit name to factor relative to the dimension's base unit. */
  units: Record<string, number>;
}

const dimensions: Dimension[] = [
  {
    units: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
    },
  },
  { units: { mg: 0.000001, g: 0.001, kg: 1, lb: 0.45359237, oz: 0.028349523125 } },
  { units: { ml: 0.001, l: 1, tsp: 0.00492892, tbsp: 0.0147868, cup: 0.236588, gal: 3.78541 } },
];

const aliases: Record<string, string> = {
  millimeter: 'mm',
  millimeters: 'mm',
  centimeter: 'cm',
  centimeters: 'cm',
  meter: 'm',
  meters: 'm',
  kilometer: 'km',
  kilometers: 'km',
  inch: 'in',
  inches: 'in',
  foot: 'ft',
  feet: 'ft',
  yard: 'yd',
  yards: 'yd',
  mile: 'mi',
  miles: 'mi',
  milligram: 'mg',
  milligrams: 'mg',
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',
  milliliter: 'ml',
  milliliters: 'ml',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cups: 'cup',
  gallon: 'gal',
  gallons: 'gal',
  celsius: 'c',
  fahrenheit: 'f',
  kelvin: 'k',
  '°c': 'c',
  '°f': 'f',
};

const canonical = (unit: string): string => aliases[unit.toLowerCase()] ?? unit.toLowerCase();

const toCelsius: Record<string, (v: number) => number> = {
  c: (v) => v,
  f: (v) => ((v - 32) * 5) / 9,
  k: (v) => v - 273.15,
};
const fromCelsius: Record<string, (v: number) => number> = {
  c: (v) => v,
  f: (v) => (v * 9) / 5 + 32,
  k: (v) => v + 273.15,
};

export function convertUnits(value: number, fromUnit: string, toUnit: string): number | null {
  const from = canonical(fromUnit);
  const to = canonical(toUnit);
  const toC = toCelsius[from];
  const fromC = fromCelsius[to];
  if (toC && fromC) return fromC(toC(value));
  const dimension = dimensions.find((d) => from in d.units && to in d.units);
  const fromFactor = dimension?.units[from];
  const toFactor = dimension?.units[to];
  if (fromFactor === undefined || toFactor === undefined) return null;
  return (value * fromFactor) / toFactor;
}

export const roundForSpeech = (value: number): number => Math.round(value * 1000) / 1000;
