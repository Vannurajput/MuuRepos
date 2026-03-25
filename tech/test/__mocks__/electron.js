module.exports = {
  app: {
    getPath: () => 'C:\\\\tmp',
    getAppPath: () => 'C:\\\\app',
    isPackaged: false
  },
  BrowserWindow: function MockBrowserWindow() {
    return {};
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  shell: {},
  nativeTheme: {}
};
