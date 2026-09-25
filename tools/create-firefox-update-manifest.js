#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const [
  xpiPath,
  version,
  addonId,
  repository,
  releaseTag,
  outputPath = 'updates.json',
] = process.argv.slice(2);

if (!xpiPath || !version || !addonId || !repository || !releaseTag) {
  console.error(
    'Usage: %s <signed.xpi> <version> <addon-id> <owner/repo> <release-tag> [output.json]',
    basename(process.argv[1]),
  );
  process.exit(1);
}

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error('repository must use owner/repo format');
}

const xpi = readFileSync(xpiPath);
const updateHash = createHash('sha256').update(xpi).digest('hex');
const updateLink = `https://github.com/${repository}/releases/download/${encodeURIComponent(releaseTag)}/${encodeURIComponent(basename(xpiPath))}`;
const updateManifest = {
  addons: {
    [addonId]: {
      updates: [
        {
          version,
          update_link: updateLink,
          update_hash: `sha256:${updateHash}`,
        },
      ],
    },
  },
};

writeFileSync(outputPath, `${JSON.stringify(updateManifest, null, 2)}\n`);
