import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const manifest = JSON.parse(readFileSync('build/manifest.json', 'utf8'));

test('Firefox launches the local background bundle', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.background.scripts, ['extension.bundle.js']);
  assert.equal(manifest.background.service_worker, undefined);
  assert.equal(
    manifest.browser_specific_settings.gecko.id,
    'hypothesis-firefox@hermitm0nk.github',
  );
  assert.deepEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions.required,
    [
      'personallyIdentifyingInfo',
      'authenticationInfo',
      'browsingActivity',
      'websiteContent',
    ],
  );
  assert.ok(statSync('build/extension.bundle.js').size > 0);
});

test('Hypothesis client is packaged for extension injection', () => {
  const boot = readFileSync('build/client/build/boot.js', 'utf8');
  assert.match(boot, /chrome\.runtime\.getURL/);
  assert.doesNotMatch(boot, /__SIDEBAR_APP_URL__|__ASSET_ROOT__/);
  assert.ok(statSync('build/client/app.html').size > 0);
  assert.ok(manifest.web_accessible_resources.some(entry =>
    entry.resources.includes('client/*'),
  ));
});
