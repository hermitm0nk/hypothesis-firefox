// The background stores Hypothesis's authorization response in session memory.
// Deliver it to the bundled client as the window message it already expects.
console.warn('[Hypothesis OAuth] sidebar bridge ready');

let expectedState;
let deliveredState;
let poll;

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
    (expectedState && message.state !== expectedState) ||
    deliveredState === message.state
  ) {
    return;
  }

  deliveredState = message.state;
  if (poll) {
    clearInterval(poll);
    poll = undefined;
  }
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

function checkStoredResponse() {
  chrome.storage.session
    .get('oauthResponse')
    .then(stored => deliver(stored.oauthResponse))
    .catch(error =>
      console.error('[Hypothesis OAuth] session read failed', error),
    );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session') {
    deliver(changes.oauthResponse?.newValue);
  }
});

// Firefox may not dispatch a session storage change to the extension iframe.
// While an OAuth popup is open, also read the stored response until it arrives.
const originalOpen = window.open.bind(window);
window.open = (url, target, features) => {
  const popup = originalOpen(url, target, features);
  if (typeof url !== 'string') {
    return popup;
  }

  let authURL;
  try {
    authURL = new URL(url);
  } catch {
    return popup;
  }
  if (
    authURL.origin !== 'https://hypothes.is' ||
    authURL.pathname !== '/oauth/authorize'
  ) {
    return popup;
  }

  expectedState = authURL.searchParams.get('state');
  deliveredState = undefined;
  if (poll) {
    clearInterval(poll);
  }
  checkStoredResponse();
  poll = setInterval(checkStoredResponse, 500);
  const activePoll = poll;
  setTimeout(() => {
    if (poll === activePoll) {
      clearInterval(poll);
      poll = undefined;
      console.error(
        '[Hypothesis OAuth] timed out waiting for sidebar delivery',
      );
    }
  }, 120000);
  return popup;
};
