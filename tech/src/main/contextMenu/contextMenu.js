const { Menu, clipboard } = require('electron');

const ellipsize = (value = '', max = 60) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const buildSearchUrl = (selection = '') => {
  const query = encodeURIComponent(selection.trim());
  return `https://www.google.com/search?q=${query}`;
};

const safeAdd = (items, condition, entry) => {
  if (condition) {
    items.push(entry);
  }
};

function showContextMenu({ mainWindow, tabManager, tabId, webContents, params }) {
  if (!mainWindow || !tabManager || !webContents || !params) return;

  const template = [];

  // Editable fields
  if (params.isEditable) {
    template.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    );
  } else {
    // Selection copy + search
    if (params.selectionText && params.selectionText.trim()) {
      const selection = params.selectionText.trim();
      template.push(
        { role: 'copy' },
        {
          label: `Search Google for "${ellipsize(selection, 30)}"`,
          click: () => {
            const url = buildSearchUrl(selection);
            tabManager.openInNewTab(url);
          }
        }
      );
      template.push({ type: 'separator' });
    }

    // Links
    if (params.linkURL) {
      template.push(
        {
          label: 'Open link in new tab',
          click: () => tabManager.openInNewTab(params.linkURL)
        },
        {
          label: 'Copy link address',
          click: () => clipboard.writeText(params.linkURL)
        }
      );
      template.push({ type: 'separator' });
    }

    // Images
    if (params.mediaType === 'image' && params.srcURL) {
      template.push(
        {
          label: 'Open image in new tab',
          click: () => tabManager.openInNewTab(params.srcURL)
        },
        {
          label: 'Copy image address',
          click: () => clipboard.writeText(params.srcURL)
        }
      );
      template.push({ type: 'separator' });
    }
  }

  // Page actions
  template.push(
    {
      label: 'Back',
      enabled: webContents.canGoBack(),
      click: () => tabManager.goBack()
    },
    {
      label: 'Forward',
      enabled: webContents.canGoForward(),
      click: () => tabManager.goForward()
    },
    {
      label: 'Reload',
      click: () => tabManager.reload()
    },
    { type: 'separator' },
    {
      label: 'Inspect element',
      click: () => webContents.inspectElement(params.x, params.y)
    }
  );

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
}

module.exports = {
  showContextMenu
};
