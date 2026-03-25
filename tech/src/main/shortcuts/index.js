const { matchShortcut } = require('./matcher');
const { isCmdOrCtrl } = require('./registry');

function registerShortcutManager(mainWindow, tabManager, launchNewInstance) {
  if (!mainWindow) return;

  const emitRendererShortcut = (channel, payload) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(channel, payload);
  };

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const handler = matchShortcut(input);
    if (!handler) return;

    event.preventDefault();
    handler.action(mainWindow, tabManager, {
      shift: input.shift,
      code: input.code,
      alt: input.alt,
      ctrlOrCmd: isCmdOrCtrl(input),
      launchNewInstance,
      emitRendererShortcut
    });
  });
}

module.exports = { registerShortcutManager };
