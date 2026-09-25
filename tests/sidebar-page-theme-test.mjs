import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync('src/sidebar-page-theme.js', 'utf8');

test(
  'page toolbar follows the selected theme and stops on sidebar destroy',
  async () => {
    const styleValues = new Map();
    const sidebar = {
      dataset: {},
      style: {
        setProperty(name, value) {
          styleValues.set(name, value);
        },
        removeProperty(name) {
          styleValues.delete(name);
        },
      },
    };
    let destroyListener;
    const sidebarLink = {
      addEventListener(type, listener) {
        assert.equal(type, 'destroy');
        destroyListener = listener;
      },
    };
    let storageChangedListener;
    let removedStorageListener;
    let observerDisconnected = false;

    class FakeMutationObserver {
      observe() {}
      disconnect() {
        observerDisconnected = true;
      }
    }

    const browser = {
      storage: {
        onChanged: {
          addListener(listener) {
            storageChangedListener = listener;
          },
          removeListener(listener) {
            removedStorageListener = listener;
          },
        },
        sync: {
          get: async () => ({ sidebarTheme: 'nord' }),
        },
      },
    };

    runInNewContext(source, {
      MutationObserver: FakeMutationObserver,
      document: {
        documentElement: {},
        querySelector: () => sidebarLink,
        querySelectorAll: () => [sidebar],
      },
      globalThis: { browser },
    });
    await Promise.resolve();

    assert.equal(sidebar.dataset.hypothesisTheme, 'nord');
    assert.equal(styleValues.get('--color-white'), '#2e3440');
    assert.equal(styleValues.get('--color-grey-2'), '#3b4252');
    assert.equal(styleValues.get('--color-grey-3'), '#434c5e');
    assert.equal(sidebar.style.colorScheme, 'dark');
    assert.equal(observerDisconnected, true);

    storageChangedListener(
      { sidebarTheme: { newValue: 'tokyo-night-light' } },
      'sync',
    );
    assert.equal(sidebar.dataset.hypothesisTheme, 'tokyo-night-light');
    assert.equal(styleValues.get('--color-white'), '#d5d6db');
    assert.equal(sidebar.style.colorScheme, 'light');

    destroyListener();
    assert.equal(removedStorageListener, storageChangedListener);
  },
);
