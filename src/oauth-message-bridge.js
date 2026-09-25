// The background sends Hypothesis's authorization response to this extension
// page, which forwards it in the format expected by the bundled client.
console.warn('[Hypothesis OAuth] sidebar bridge ready');

/** @type {string | undefined} */
let deliveredState;

/** @param {unknown} message */
function deliver(message) {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('code' in message) ||
    !('state' in message) ||
    typeof message.code !== 'string' ||
    !message.code ||
    typeof message.state !== 'string' ||
    !/^[a-f0-9]{16}$/.test(message.state) ||
    deliveredState === message.state
  ) {
    return;
  }

  deliveredState = message.state;
  window.postMessage(
    {
      type: 'authorization_response',
      code: message.code,
      state: message.state,
    },
    window.location.origin,
  );
  console.warn('[Hypothesis OAuth] code delivered to sidebar');
}

const oauthPort = chrome.runtime.connect({ name: 'hypothesis-firefox-oauth' });
oauthPort.onMessage.addListener(message => {
  if (message?.type === 'hypothesis-firefox-oauth-delivery') {
    deliver(message);
  }
});
