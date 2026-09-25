// The bundled Hypothesis client accepts the authorization code as a window
// message. The background page validates the Hypothesis callback, then writes
// it to in-memory session storage. The client checks the OAuth state as well.
chrome.storage.onChanged.addListener((changes, area) => {
  /** @type {{ code?: unknown, state?: unknown } | undefined} */
  const message = changes.oauthResponse?.newValue;
  if (
    area !== 'session' ||
    !message ||
    typeof message.code !== 'string' ||
    !message.code ||
    typeof message.state !== 'string' ||
    !/^[a-f0-9]{16}$/.test(message.state)
  ) {
    return;
  }

  window.postMessage(
    {
      type: 'authorization_response',
      code: message.code,
      state: message.state,
    },
    window.location.origin,
  );
});
