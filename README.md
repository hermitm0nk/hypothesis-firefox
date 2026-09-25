# Hypothesis for Firefox (community build)

This public fork of [hypothesis/browser-extension](https://github.com/hypothesis/browser-extension) builds the existing Hypothesis client as a Firefox WebExtension. It is **not an official Hypothesis release**. The original code and bundled third-party components retain their respective licenses; see [LICENSE](LICENSE).

## Why this addresses the bookmarklet's CSP failure

The bookmarklet appends `https://hypothes.is/embed.js` as a page script. A site's `script-src` can reject that script (and its `eval` restrictions can reject page-world code). This extension instead bundles the client and uses `scripting.executeScript` to run `/client/build/boot.js` in Firefox's isolated content-script world. The sidebar is a packaged `moz-extension://` resource. It does not remove or rewrite the site's CSP headers. The Firefox manifest uses `background.scripts` because Firefox does not implement MV3 `background.service_worker`.

The client still depends on access to the Hypothesis service. Firefox restricts extension injection into browser internal pages, other extensions, and some special documents. Some embedded frames, document formats, and unusual page structures may need additional work. A strict page CSP alone should no longer stop the packaged boot script, but this has not yet been verified in a running Firefox against the particular sites that failed for the user. The extension declares the account, visited-page, and annotation data it sends to Hypothesis; it requires Firefox 140 or later for Firefox's built-in data consent.

Mozilla's static linter reports `Function`/`eval` warnings in bundled upstream dependencies. In the client bundle, `Function("return this")` is a fallback reached only if browser globals such as `self` are absent. The bundled PDF.js checks whether eval is available and falls back when it is blocked; its `eval("require")` is guarded for Node.js. These warnings are not proof that annotation on a normal HTML page executes eval. A live Firefox test is still needed to establish that the pages in question work end to end.

## Build and test

Requires Node 22, Corepack, `make`, `rsync`, `zip`, and the browser dependencies for Playwright.

```sh
corepack enable
yarn install --immutable
yarn playwright install chromium
FIREFOX_FORK_BUILD=1 make sure
FIREFOX_FORK_BUILD=1 make build SETTINGS_FILE=settings/firefox-prod.json dist/hypothesis-firefox.xpi
node --test tests/firefox-build-test.mjs
yarn web-ext lint --source-dir build
```

To load temporarily in Firefox, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `build/manifest.json`. This temporary load is for development; ordinary Firefox requires Mozilla's signature for persistent installation. The unsigned XPI uploaded by CI is for inspection only.

## CI and signing

The [GitHub Actions workflow](.github/workflows/continuous-integration.yml) runs formatting, lint, type checking, unit tests, an extension build, a Firefox package check, and `web-ext lint`. On pushes to `main` or manual runs, it additionally requests **unlisted** signing from Mozilla if both repository Actions secrets `AMO_API_KEY` and `AMO_API_SECRET` are set. A successful run uploads a `firefox-signed-installable-xpi` artifact. Create an AMO developer account and [generate API credentials](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) to enable this step. Do not put credentials in the repo. The manifest specifies the stable Gecko add-on ID `hypothesis-firefox@hermitm0nk.github` for future updates.

The packaged client currently uses the upstream Firefox `oauthClientId`. Whether the Hypothesis OAuth server accepts this fork's Gecko origin must be verified after installing and signing; a separate registered OAuth client may be necessary. Until login and token refresh have been tested, do not assume this fixes cookie partitioning or restore `network.cookie.cookieBehavior=5` on that basis. The packaged sidebar and site CSP behavior can be tested independently of login.

## Provenance

Based on the Hypothesis browser extension at the fork point, with the Firefox background manifest, add-on identity, packaging tests, and signing workflow adapted here. No remote executable script is fetched at runtime by the extension loader. See upstream [development instructions](docs/building.md) for details of the underlying client.
