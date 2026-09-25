import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const callback = readFileSync('src/oauth-callback.js', 'utf8');
const bridge = readFileSync('src/oauth-message-bridge.js', 'utf8');
const state = '0123456789abcdef';

test('callback waits for background confirmation before closing', async () => {
  let observe;
  let confirm;
  let stopped = 0;
  let closed = 0;
  const messages = [];
  const page = {
    textContent: JSON.stringify({
      code: 'example',
      state,
      origin: 'moz-extension://upstream',
    }),
  };
  const window = {
    stop: () => ++stopped,
    close: () => ++closed,
  };
  window.top = window;
  vm.runInNewContext(callback, {
    window,
    location: { pathname: '/oauth/authorize' },
    document: { querySelector: () => page },
    chrome: {
      runtime: {
        sendMessage: message => {
          messages.push(message);
          return new Promise(resolve => {
            confirm = resolve;
          });
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
  assert.equal(stopped, 1);
  assert.equal(closed, 0);
  assert.deepEqual(
    { ...messages[0] },
    { type: 'hypothesis-firefox-oauth-response', code: 'example', state },
  );
  confirm({ stored: true });
  await Promise.resolve();
  assert.equal(closed, 1);
});

test('bridge forwards session changes and polls while login is open', async () => {
  let listener;
  let tick;
  const storedResponse = { value: undefined };
  const posted = [];
  const window = {
    location: { origin: 'moz-extension://our-addon' },
    open: () => ({}),
    postMessage: (...args) => posted.push(args),
  };
  vm.runInNewContext(bridge, {
    chrome: {
      storage: {
        session: { get: async () => ({ oauthResponse: storedResponse.value }) },
        onChanged: {
          addListener: fn => {
            listener = fn;
          },
        },
      },
    },
    window,
    URL,
    setInterval: fn => {
      tick = fn;
      return 1;
    },
    clearInterval: () => {},
    setTimeout: () => {},
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

  const nextState = 'fedcba9876543210';
  window.open(
    `https://hypothes.is/oauth/authorize?state=${nextState}`,
    'Log in to Hypothesis',
  );
  storedResponse.value = { code: 'next-code', state: nextState };
  tick();
  await Promise.resolve();
  assert.equal(posted.length, 2);
  assert.deepEqual(
    { ...posted[1][0] },
    { type: 'authorization_response', code: 'next-code', state: nextState },
  );
});
