#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const stylesheetPath = process.argv[2];
if (!stylesheetPath) {
  throw new Error('Usage: patch-sidebar-theme-css.js <sidebar.css>');
}

const stylesheet = readFileSync(stylesheetPath, 'utf8');
const upstreamRule = '*{border-color:#dbdbdb}';
const themedRule = '*{border-color:var(--color-grey-3)}';

if (stylesheet.includes(themedRule)) {
  process.exit(0);
}

const occurrences = stylesheet.split(upstreamRule).length - 1;
if (occurrences !== 1) {
  throw new Error(
    `Expected one upstream sidebar border rule, found ${occurrences}`,
  );
}

writeFileSync(stylesheetPath, stylesheet.replace(upstreamRule, themedRule));
