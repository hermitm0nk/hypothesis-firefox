import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('Firefox update manifest points to the signed release XPI and hash', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'firefox-update-manifest-'));
  const xpiPath = join(tempDir, 'addon.xpi');
  const outputPath = join(tempDir, 'updates.json');
  const xpi = Buffer.from('signed XPI fixture');
  writeFileSync(xpiPath, xpi);

  try {
    const result = spawnSync(
      process.execPath,
      [
        'tools/create-firefox-update-manifest.js',
        xpiPath,
        '1.2.3.4',
        'addon@example.org',
        'owner/repo',
        'v1.2.3-firefox.4',
        outputPath,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);

    const updateManifest = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.deepEqual(updateManifest, {
      addons: {
        'addon@example.org': {
          updates: [
            {
              version: '1.2.3.4',
              update_link:
                'https://github.com/owner/repo/releases/download/v1.2.3-firefox.4/addon.xpi',
              update_hash: `sha256:${createHash('sha256').update(xpi).digest('hex')}`,
            },
          ],
        },
      },
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
