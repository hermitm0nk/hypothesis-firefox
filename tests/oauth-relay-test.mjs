import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const callback = readFileSync('src/oauth-callback.js', 'utf8');
const bridge = readFileSync('src/oauth-message-bridge.js', 'utf8');
const state = '0123456789abcdef';

test('callback relays the code and state from Hypothesis completion page', () => {
  let observe;
  const messages = [];
  const page = {
    textContent: JSON.stringify({
      code: 'example',
      state,
      origin: 'moz-extension://upstream',
    }),
  };
  const window = {};
  window.top = window;
  vm.runInNewContext(callback, {
    window,
    location: { pathname: '/oauth/authorize' },
    document: { querySelector: () => page },
    chrome: {
      runtime: {
        sendMessage: message => {
          messages.push(message);
          return Promise.resolve();
        },
      },
    },
    MutationObserver: class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
      disconnect() {}
    },
  });
  observe();
  observe();
  assert.equal(messages.length, 1);
  assert.deepEqual(
    { ...messages[0] },
    { type: 'hypothesis-firefox-oauth-response', code: 'example', state },
  );
});

test('bridge forwards session response for the bundled client', () => {
  let listener;
  const posted = [];
  vm.runInNewContext(bridge, {
    chrome: {
      storage: {
        onChanged: {
          addListener: fn => {
            listener = fn;
          },
        },
      },
    },
    window: {
      location: { origin: 'moz-extension://our-addon' },
      postMessage: (...args) => posted.push(args),
    },
  });
  const changes = { oauthResponse: { newValue: { code: 'example', state } } };
  listener(changes, 'sync');
  listener({ oauthResponse: { newValue: null } }, 'session');
  assert.equal(posted.length, 0);
  listener(changes, 'session');
  assert.equal(posted.length, 1);
  assert.equal(posted[0][1], 'moz-extension://our-addon');
  assert.deepEqual(
    { ...posted[0][0] },
    { type: 'authorization_response', code: 'example', state },
  );
});
