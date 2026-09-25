// The bundled Hypothesis client accepts the authorization code as a window
// message. Only relay responses sent by our content script on Hypothesis's
// authorization page. The client also checks the unpredictable OAuth state.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    sender.id !== chrome.runtime.id ||
    typeof sender.url !== 'string' ||
    !/^https:\/\/hypothes\.is\/oauth\/authorize(?:\?|$)/.test(sender.url) ||
    message?.type !== 'hypothesis-firefox-oauth-response' ||
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
