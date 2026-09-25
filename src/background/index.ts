import { chromeAPI } from './chrome-api';
import { Extension } from './extension';
import type { ExternalMessage } from './messages';

/**
 * Link to survey to show users after extension is uninstalled.
 *
 * See https://github.com/hypothesis/product-backlog/issues/1599.
 */
export const uninstallURL =
  'https://docs.google.com/forms/d/e/1FAIpQLSd250Bi4xvxxvL-SgajHRmk8K1LMLZLGRoYkp6WSwT8PDTlLA/viewform?usp=sf_link';

/**
 * Initialize the extension's Service Worker / background page.
 *
 * This is exported for use in tests.
 */
export async function init() {
  const extension = new Extension();
  const initialized = extension.init();

  // The OAuth completion page can close before a message reaches the sidebar
  // iframe. Receive it in the persistent Firefox background page, then use
  // session storage to notify the iframe without persisting the code to disk.
  chromeAPI.runtime.onMessage?.addListener((message, sender, sendResponse) => {
    if (
      message?.type !== 'hypothesis-firefox-oauth-response' ||
      sender.id !== chromeAPI.runtime.id ||
      typeof sender.url !== 'string' ||
      !/^https:\/\/hypothes\.is\/oauth\/authorize(?:\?|$)/.test(sender.url) ||
      typeof sender.tab?.id !== 'number' ||
      typeof message.code !== 'string' ||
      !message.code ||
      typeof message.state !== 'string' ||
      !/^[a-f0-9]{16}$/.test(message.state) ||
      !chromeAPI.storage.session
    ) {
      return false;
    }

    const response = { code: message.code, state: message.state };
    const session = chromeAPI.storage.session;
    session
      .set({ oauthResponse: response })
      .then(() => {
        console.warn('[Hypothesis OAuth] background stored code');
        sendResponse({ stored: true });
      })
      .catch(error => {
        console.error('[Hypothesis OAuth] background storage failed', error);
        sendResponse({ stored: false });
      });

    // Authorization codes are short-lived. Remove a response that no open
    // sidebar consumed, without removing a newer login attempt.
    setTimeout(async () => {
      const stored = await session.get('oauthResponse');
      const pending = stored.oauthResponse as { state?: string } | undefined;
      if (pending?.state === response.state) {
        await session.remove('oauthResponse');
      }
    }, 30000);
    return true;
  });

  // Tokens indicating which features the current extension supports.
  const allFeatures = [
    // "activate" message to activate extension on current tab and
    // optionally first navigate to a different URL.
    'activate',
  ];

  chromeAPI.runtime.onInstalled.addListener(async installDetails => {
    // Check whether this is the inital installation or an update of an existing
    // installation.
    if (installDetails.reason === 'install') {
      const extensionInfo = await chromeAPI.management.getSelf();
      extension.firstRun(extensionInfo);
    }
  });

  // Respond to messages sent by the JavaScript from https://hyp.is.
  // This is how it knows whether the user has this Chrome extension installed.
  chromeAPI.runtime.onMessageExternal.addListener(
    (request: ExternalMessage, sender, sendResponse) => {
      switch (request.type) {
        case 'ping':
          {
            const queryFeatures = request.queryFeatures ?? [];
            const features = allFeatures.filter(f => queryFeatures.includes(f));
            sendResponse({ type: 'pong', features });
          }
          break;
        case 'activate':
          {
            if (typeof sender.tab?.id !== 'number') {
              return;
            }

            const { url, query } = request;
            if (url) {
              chromeAPI.tabs.update(sender.tab.id, { url });
            }
            extension.activate(sender.tab.id, {
              afterNavigationTo: url,
              query,
            });

            sendResponse({ active: true });
          }
          break;
      }
    },
  );

  chromeAPI.runtime.requestUpdateCheck?.().then(() => {
    chromeAPI.runtime.onUpdateAvailable.addListener(() =>
      chromeAPI.runtime.reload(),
    );
  });

  // Show survey to users after they uninstall extension.
  chromeAPI.runtime.setUninstallURL(uninstallURL);

  await initialized;
}

// Set by Rollup in tests
declare const EXTENSION_TESTS: undefined | string;

// Vitest sets NODE_ENV to test
const inTests = typeof EXTENSION_TESTS !== 'undefined';
if (!inTests) {
  init();
}
