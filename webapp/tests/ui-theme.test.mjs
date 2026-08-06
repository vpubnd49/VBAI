import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(testDirectory, '..');
const cssPath = path.join(webappRoot, 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');

console.log('[TEST] Running administrative light UI theme tests...');

const definitionMatches = [
  ...css.matchAll(/(--[a-z0-9_-]+)\s*:/gi),
];

const definitions = new Set(
  definitionMatches.map((match) => match[1])
);

const variableUses = [
  ...css.matchAll(
    /var\(\s*(--[a-z0-9_-]+)(\s*,[^)]*)?\)/gi
  ),
];

const unresolvedVariables = [
  ...new Set(
    variableUses
      .filter((match) => {
        const hasFallback = Boolean(match[2]);

        return (
          !definitions.has(match[1]) &&
          !hasFallback
        );
      })
      .map((match) => match[1])
  ),
].sort();

assert.deepEqual(
  unresolvedVariables,
  [],
  `Undefined CSS variables: ${unresolvedVariables.join(', ')}`
);

console.log('  PASS: all CSS variables resolve');

const requiredTokens = [
  '--pine-300',
  '--mist-600',
  '--mist-500',
  '--mist-400',
  '--earth-500',
  '--earth-400',
  '--rose-500',
  '--rose-400',
  '--daquy-500',
  '--daquy-400',
  '--daquy-300',
  '--surface-blue',
  '--surface-soft',
  '--surface-muted',
  '--text-on-accent',
  '--focus-ring',
];

for (const token of requiredTokens) {
  assert.ok(
    definitions.has(token),
    `Missing required theme token: ${token}`
  );
}

console.log('  PASS: complete administrative theme tokens exist');

assert.match(css, /color-scheme:\s*light/);
assert.match(css, /--bg-primary:\s*#f4f7fb/i);
assert.match(css, /--bg-secondary:\s*#ffffff/i);
assert.match(css, /--text-primary:\s*#0f172a/i);
assert.match(css, /--accent:\s*#2563eb/i);

assert.doesNotMatch(
  css,
  /Semantic Dark Blue Theme/i
);

assert.doesNotMatch(
  css,
  /--bg-primary:\s*#0a1426/i
);

console.log('  PASS: dark-theme root values are removed');

const moduleBeforeCount = (
  css.match(
    /^[ \t]*\.module-card::before[ \t]*\{/gm
  ) || []
).length;

const moduleHoverCount = (
  css.match(
    /^[ \t]*\.module-card:hover[ \t]*\{/gm
  ) || []
).length;

const moduleHoverBeforeCount = (
  css.match(
    /^[ \t]*\.module-card:hover::before[ \t]*\{/gm
  ) || []
).length;

assert.equal(
  moduleBeforeCount,
  1,
  'module-card::before must be declared exactly once'
);

assert.equal(
  moduleHoverCount,
  1,
  'module-card:hover must be declared exactly once'
);

assert.equal(
  moduleHoverBeforeCount,
  1,
  'module-card:hover::before must be declared exactly once'
);

assert.match(
  css,
  /var\(\s*--card-accent,[\s\S]*var\(\s*--accent\)/
);

console.log('  PASS: module card rules are not duplicated');

assert.match(
  css,
  /\.nav-item\.active[\s\S]*color:\s*var\(--text-on-accent\)/
);

assert.match(
  css,
  /:focus-visible[\s\S]*var\(--focus-ring\)/
);

console.log('  PASS: active and focus states use semantic tokens');

function getHexToken(tokenName) {
  const escaped = tokenName.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const pattern = new RegExp(
    `${escaped}\\s*:\\s*(#[0-9a-f]{6})\\s*;`,
    'i'
  );

  const match = css.match(pattern);

  assert.ok(
    match,
    `Theme token must be a six-digit hex color: ${tokenName}`
  );

  return match[1];
}

function hexToRgb(hex) {
  const normalized = hex.slice(1);

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function channelToLinear(channel) {
  const value = channel / 255;

  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [red, green, blue] = hexToRgb(hex)
    .map(channelToLinear);

  return (
    0.2126 * red +
    0.7152 * green +
    0.0722 * blue
  );
}

function contrastRatio(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);

  const lighter = Math.max(
    firstLuminance,
    secondLuminance
  );

  const darker = Math.min(
    firstLuminance,
    secondLuminance
  );

  return (lighter + 0.05) / (darker + 0.05);
}

const background = getHexToken('--bg-secondary');
const primaryText = getHexToken('--text-primary');
const secondaryText = getHexToken('--text-secondary');
const accent = getHexToken('--accent');
const textOnAccent = getHexToken('--text-on-accent');

assert.ok(
  contrastRatio(primaryText, background) >= 7,
  'Primary text must satisfy enhanced contrast'
);

assert.ok(
  contrastRatio(secondaryText, background) >= 4.5,
  'Secondary text must satisfy normal-text contrast'
);

assert.ok(
  contrastRatio(textOnAccent, accent) >= 4.5,
  'Accent button text must satisfy normal-text contrast'
);

console.log('  PASS: core text contrast satisfies WCAG thresholds');
console.log('Administrative light UI theme tests passed.');
