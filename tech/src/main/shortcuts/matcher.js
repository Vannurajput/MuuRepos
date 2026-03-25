const { KEY, isCmdOrCtrl } = require('./registry');

const getActiveTabId = (manager) => manager?.activeTabId;
const closeWindow = (win) => win?.close?.();
const focusAddressBar = (win, payload = {}) => {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('shortcuts:focus-address', payload);
};

const handleTabJump = (manager, index) => {
  if (!manager || typeof manager.getTabIdByIndex !== 'function') return;
  const target = manager.getTabIdByIndex(index);
  if (target != null) manager.setActiveTab(target);
};

const handleLastTabJump = (manager) => {
  if (!manager || typeof manager.getLastTabId !== 'function') return;
  const target = manager.getLastTabId();
  if (target != null) manager.setActiveTab(target);
};

const shortcutHandlers = [
  {
    match: (input) => input.alt && !isCmdOrCtrl(input) && !input.shift && input.code === KEY.HOME,
    action: (_win, manager) => manager?.goHome?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.L,
    action: (win) => focusAddressBar(win, { selectAll: true })
  },
  {
    match: (input) => input.alt && !isCmdOrCtrl(input) && !input.shift && input.code === KEY.D,
    action: (win) => focusAddressBar(win, { selectAll: true })
  },
  {
    match: (input) => !input.alt && !isCmdOrCtrl(input) && !input.shift && input.code === KEY.F6,
    action: (win) => focusAddressBar(win, { selectAll: true })
  },
  {
    match: (input) =>
      isCmdOrCtrl(input) && !input.alt && !input.shift && (input.code === KEY.K || input.code === KEY.E),
    action: (win) => focusAddressBar(win, { searchMode: true })
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.shift && !input.alt && input.code === KEY.T,
    action: (_win, manager) => manager?.createTab?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.shift && !input.alt && (input.code === KEY.W || input.code === KEY.F4),
    action: (_win, manager) => {
      const active = getActiveTabId(manager);
      if (active != null) manager.destroyTab(active);
    }
  },
  {
    match: (input) => isCmdOrCtrl(input) && input.shift && !input.alt && input.code === KEY.T,
    action: (_win, manager) => manager?.reopenLastClosed?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && input.code === KEY.TAB,
    action: (_win, manager, { shift }) => {
      if (shift) manager?.activatePreviousTab?.();
      else manager?.activateNextTab?.();
    }
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code >= KEY.DIGIT_1 && input.code <= KEY.DIGIT_8,
    action: (_win, manager, { code }) => {
      const index = Number(code.slice(-1)) - 1;
      handleTabJump(manager, index);
    }
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.DIGIT_9,
    action: (_win, manager) => handleLastTabJump(manager)
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.shift && !input.alt && input.code === KEY.N,
    action: (_win, _manager, { launchNewInstance }) => launchNewInstance?.()
  },
  {
    match: (input) => input.alt && !isCmdOrCtrl(input) && !input.shift && input.code === KEY.F4,
    action: (win) => closeWindow(win)
  },
  {
    match: (input) => input.alt && !isCmdOrCtrl(input) && !input.shift && input.code === KEY.LEFT,
    action: (_win, manager) => manager?.goBack?.()
  },
  {
    match: (input) => input.alt && !isCmdOrCtrl(input) && !input.shift && input.code === KEY.RIGHT,
    action: (_win, manager) => manager?.goForward?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.F,
    action: (_win, manager) => manager?.triggerFindInPage?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.P,
    action: (_win, manager) => manager?.printActive?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.S,
    action: (_win, manager) => manager?.saveActivePage?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.U,
    action: (_win, manager) => manager?.viewSourceActive?.()
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.D,
    action: (_win, _manager, { emitRendererShortcut }) =>
      emitRendererShortcut?.('shortcuts:bookmark-current')
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.J,
    action: (_win, _manager, { emitRendererShortcut }) =>
      emitRendererShortcut?.('shortcuts:open-downloads')
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && !input.shift && input.code === KEY.H,
    action: (_win, _manager, { emitRendererShortcut }) =>
      emitRendererShortcut?.('shortcuts:open-history')
  },
  {
    match: (input) =>
      input.code === KEY.F12 && !input.alt && !input.shift && !isCmdOrCtrl(input),
    action: (_win, manager) => manager?.openDevTools?.()
  },
  {
    match: (input) =>
      input.code === KEY.I && isCmdOrCtrl(input) && input.shift && !input.alt,
    action: (_win, manager) => manager?.openDevTools?.()
  },
  {
    match: (input) => !input.alt && input.code === KEY.F5,
    action: (_win, manager, { shift, ctrlOrCmd }) => {
      if (shift || ctrlOrCmd) manager?.reloadIgnoringCache?.();
      else manager?.reload?.();
    }
  },
  {
    match: (input) => isCmdOrCtrl(input) && !input.alt && input.code === KEY.R,
    action: (_win, manager, { shift }) => {
      if (shift) manager?.reloadIgnoringCache?.();
      else manager?.reload?.();
    }
  },
  {
    match: (input) =>
      isCmdOrCtrl(input) &&
      !input.alt &&
      ((input.code === KEY.PLUS && input.shift) || input.code === KEY.NUMPAD_PLUS),
    action: (_win, manager) => manager?.nudgeActiveZoom?.(1)
  },
  {
    match: (input) =>
      isCmdOrCtrl(input) &&
      !input.alt &&
      !input.shift &&
      (input.code === KEY.MINUS || input.code === KEY.NUMPAD_MINUS),
    action: (_win, manager) => manager?.nudgeActiveZoom?.(-1)
  },
  {
    match: (input) =>
      isCmdOrCtrl(input) &&
      !input.alt &&
      !input.shift &&
      (input.code === KEY.ZERO || input.code === KEY.NUMPAD_ZERO),
    action: (_win, manager) => manager?.resetZoom?.()
  }
];

const matchShortcut = (input) => {
  return shortcutHandlers.find((handler) => handler.match(input));
};

module.exports = {
  matchShortcut
};
