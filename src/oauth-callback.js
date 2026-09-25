// Firefox fallback for the Hypothesis OAuth web_message response. The server's
// post-auth page closes its popup immediately after posting to window.opener.
// In a Firefox extension iframe that cross-origin message can be lost, and the
// popup can unload before an asynchronous extension message completes.
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
    // The server's module script closes the popup. Stop loading that script
    // until the background has safely received the authorization code.
    window.stop();
    chrome.runtime
      .sendMessage({
        type: 'hypothesis-firefox-oauth-response',
        code: response.code,
        state: response.state,
      })
      .then(result => {
        if (result?.stored) {
          window.close();
        } else {
          console.error('Hypothesis OAuth relay was not accepted');
        }
      })
      .catch(error => console.error('Hypothesis OAuth relay failed', error));
  });

  observer.observe(document, { childList: true, subtree: true });
})();
