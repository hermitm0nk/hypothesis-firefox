// Firefox fallback for the Hypothesis OAuth web_message response. The server's
// post-auth page closes its popup immediately after posting to window.opener.
// In an extension sidebar iframe that cross-origin message can be lost.
// Relay the same code and state through extension messaging before it closes.
(() => {
  if (window !== window.top || location.pathname !== '/oauth/authorize') {
    return;
  }

  let sent = false;
  const observer = new MutationObserver(() => {
    if (sent) {
      return;
    }

    const settings = document.querySelector('script.js-hypothesis-settings');
    if (!settings) {
      return;
    }

    let response;
    try {
      response = JSON.parse(settings.textContent);
    } catch {
      return;
    }

    if (
      typeof response.code !== 'string' ||
      !response.code ||
      typeof response.state !== 'string' ||
      !/^[a-f0-9]{16}$/.test(response.state)
    ) {
      return;
    }

    sent = true;
    observer.disconnect();
    chrome.runtime.sendMessage({
      type: 'hypothesis-firefox-oauth-response',
      code: response.code,
      state: response.state,
    });
  });

  observer.observe(document, { childList: true, subtree: true });
})();
