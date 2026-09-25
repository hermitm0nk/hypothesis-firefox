/**
 * Return the checkbox that toggles whether badge requests are sent.
 */
function badgeCheckbox() {
  return /** @type {HTMLInputElement} */ (document.getElementById('badge'));
}

function themeSelect() {
  return /** @type {HTMLSelectElement} */ (
    document.getElementById('sidebar-theme')
  );
}

function saveOptions() {
  chrome.storage.sync.set({
    badge: badgeCheckbox().checked,
    sidebarTheme: themeSelect().value,
  });
}

function loadOptions() {
  chrome.storage.sync.get(
    {
      badge: true,
      sidebarTheme: 'default',
    },
    items => {
      badgeCheckbox().checked = !!items.badge;
      themeSelect().value =
        typeof items.sidebarTheme === 'string' ? items.sidebarTheme : 'default';
    },
  );
}

document.addEventListener('DOMContentLoaded', loadOptions);
badgeCheckbox().addEventListener('click', saveOptions);
themeSelect().addEventListener('change', saveOptions);
