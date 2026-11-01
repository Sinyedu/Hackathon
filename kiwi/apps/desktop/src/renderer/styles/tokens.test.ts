import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rendererDir = join(__dirname, '..');
const tokensCss = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

function parseTokens(css: string): Map<string, string> {
  return new Map(
    [...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1] ?? '', m[2] ?? '']),
  );
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const textPairs: [string, string][] = [
  ['text', 'surface'],
  ['text', 'surface-raised'],
  ['text', 'surface-sunken'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-sunken'],
  ['text-on-accent', 'accent'],
  ['chip-done-text', 'chip-done-bg'],
  ['chip-planned-text', 'chip-planned-bg'],
  ['chip-failed-text', 'chip-failed-bg'],
  ['chip-undone-text', 'chip-undone-bg'],
];

describe('design tokens', () => {
  const darkStart = tokensCss.indexOf('prefers-color-scheme: dark');
  const light = parseTokens(tokensCss.slice(0, darkStart));
  const dark = new Map([...light, ...parseTokens(tokensCss.slice(darkStart))]);

  it.each([
    ['light', light],
    ['dark', dark],
  ])('keeps text contrast at 4.5:1 or better in %s', (_name, tokens) => {
    for (const [fg, bg] of textPairs) {
      const ratio = contrast(tokens.get(fg) ?? '', tokens.get(bg) ?? '');
      expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('has no hard-coded colors outside tokens.css', () => {
    const offenders: string[] = [];
    const visit = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) visit(path);
        else if (
          /\.(css|tsx?)$/.test(name) &&
          name !== 'tokens.css' &&
          !name.endsWith('.test.ts')
        ) {
          if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(readFileSync(path, 'utf8')))
            offenders.push(path);
        }
      }
    };
    visit(rendererDir);
    expect(offenders).toEqual([]);
  });
});
