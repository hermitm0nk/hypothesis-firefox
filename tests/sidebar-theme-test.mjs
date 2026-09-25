import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chromium } from 'playwright';

const themeStyles = readFileSync('src/sidebar-theme.css', 'utf8');

test('Nord overrides upstream light borders and tones down labels', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <style>${themeStyles}</style>
      <style>
        :root { --color-grey-3: #dbdbdb; --color-grey-9: #202020; }
        * { border-color: var(--color-grey-3); }
        .card { border-width: 1px; border-style: solid; }
        .label { color: var(--color-grey-9); }
      </style>
      <div class="card" data-testid="card">Annotation</div>
      <span class="label" data-testid="label">Author</span>
    `);
    await page.locator('html').evaluate(element => {
      element.dataset.hypothesisTheme = 'nord';
    });

    assert.equal(
      await page
        .locator('[data-testid="card"]')
        .evaluate(element => getComputedStyle(element).borderTopColor),
      'rgb(59, 66, 82)',
    );
    assert.equal(
      await page
        .locator('[data-testid="label"]')
        .evaluate(element => getComputedStyle(element).color),
      'rgb(196, 204, 216)',
    );
  } finally {
    await browser.close();
  }
});
