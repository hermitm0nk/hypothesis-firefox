import { init, uninstallURL, $imports } from '../../src/background';

let extension;

function FakeExtension() {
  extension = this; // eslint-disable-line consistent-this

  this.activate = sinon.stub();
  this.init = sinon.stub().resolves();
  this.install = sinon.stub();
  this.firstRun = sinon.stub();
}

function eventListenerStub() {
  return {
    addListener: sinon.stub(),
  };
}

describe('background/index', () => {
  let fakeChromeAPI;

  beforeEach(() => {
    fakeChromeAPI = {
      runtime: {
        id: '1234',
        getURL: sinon.stub(),
        sendMessage: sinon.stub().resolves(),
        requestUpdateCheck: sinon.stub().resolves(),
        onInstalled: eventListenerStub(),
        onMessageExternal: eventListenerStub(),
        onMessage: eventListenerStub(),
        onUpdateAvailable: eventListenerStub(),
        setUninstallURL: sinon.stub().resolves(),
      },
      management: {
        getSelf: sinon.stub().resolves({ installType: 'normal', id: '1234' }),
      },
      tabs: {
        update: sinon.stub(),
      },
      storage: {
        session: {
          set: sinon.stub().resolves(),
          get: sinon.stub().resolves({}),
          remove: sinon.stub().resolves(),
        },
      },
    };

    $imports.$mock({
      './chrome-api': { chromeAPI: fakeChromeAPI },
      './extension': { Extension: FakeExtension },
    });
    init();
  });

  afterEach(() => {
    $imports.$restore();
  });

  /**
   * Simulate an external request being sent to the extension from a web page,
   * such as the bouncer (hyp.is) service, via the `chrome.runtime.sendMessage`
   * API.
   */
  function simulateExternalMessage(request, sender, sendResponse) {
    const cb = fakeChromeAPI.runtime.onMessageExternal.addListener.args[0][0];
    return cb(request, sender, sendResponse);
  }

  context('when the extension is installed', () => {
    function triggerInstallEvent() {
      const cb = fakeChromeAPI.runtime.onInstalled.addListener.args[0][0];
      return cb({ reason: 'install' });
    }

    it("calls the extension's first run hook", async () => {
      await triggerInstallEvent();
      assert.calledWith(extension.firstRun, {
        id: '1234',
        installType: 'normal',
      });
    });
  });

  it('shows survey to users after extension is uninstalled', () => {
    assert.calledWith(fakeChromeAPI.runtime.setUninstallURL, uninstallURL);
  });

  it('stores a validated OAuth callback in session memory', async () => {
    const cb = fakeChromeAPI.runtime.onMessage.addListener.args[0][0];
    const sendResponse = sinon.stub();
    const accepted = cb(
      {
        type: 'hypothesis-firefox-oauth-response',
        code: 'example',
        state: '0123456789abcdef',
      },
      {
        id: '1234',
        url: 'https://hypothes.is/oauth/authorize?response_mode=web_message',
        tab: { id: 20 },
      },
      sendResponse,
    );

    assert.equal(accepted, true);
    assert.calledWith(fakeChromeAPI.storage.session.set, {
      oauthResponse: { code: 'example', state: '0123456789abcdef' },
    });
    await Promise.resolve();
    assert.calledWith(fakeChromeAPI.runtime.sendMessage, {
      type: 'hypothesis-firefox-oauth-delivery',
      code: 'example',
      state: '0123456789abcdef',
    });
    assert.calledWith(sendResponse, { stored: true });
  });

  describe('bouncer (hyp.is) message handling', () => {
    it('responds to basic "ping" message', () => {
      const sender = {};
      const sendResponse = sinon.stub();
      simulateExternalMessage({ type: 'ping' }, sender, sendResponse);
      assert.calledWith(sendResponse, { type: 'pong', features: [] });
    });

    it('responds to "ping" message with `queryFeatures`', () => {
      const sender = {};
      const sendResponse = sinon.stub();
      simulateExternalMessage(
        { type: 'ping', queryFeatures: ['activate'] },
        sender,
        sendResponse,
      );
      assert.calledWith(sendResponse, { type: 'pong', features: ['activate'] });
    });

    it('responds to "activate" message with URL', () => {
      const sender = { tab: { id: 123 } };
      const sendResponse = sinon.stub();

      simulateExternalMessage(
        {
          type: 'activate',
          url: 'https://example.com',
          query: '#annotations:1234',
        },
        sender,
        sendResponse,
      );

      assert.calledWith(fakeChromeAPI.tabs.update, 123, {
        url: 'https://example.com',
      });
      assert.calledWith(extension.activate, 123, {
        afterNavigationTo: 'https://example.com',
        query: '#annotations:1234',
      });
      assert.calledWith(sendResponse, { active: true });
    });

    it('responds to "activate" message without URL', () => {
      const sender = { tab: { id: 123 } };
      const sendResponse = sinon.stub();

      simulateExternalMessage(
        {
          type: 'activate',
          query: '#annotations:1234',
        },
        sender,
        sendResponse,
      );

      assert.notCalled(fakeChromeAPI.tabs.update);
      assert.calledWith(
        extension.activate,
        123,
        sinon.match({
          query: '#annotations:1234',
        }),
      );
      assert.calledWith(sendResponse, { active: true });
    });

    it('ignores "activate" message that did not come from a tab', () => {
      const sender = {};
      const sendResponse = sinon.stub();

      simulateExternalMessage(
        {
          type: 'activate',
          query: '#annotations:1234',
        },
        sender,
        sendResponse,
      );

      assert.notCalled(fakeChromeAPI.tabs.update);
    });
  });
});
