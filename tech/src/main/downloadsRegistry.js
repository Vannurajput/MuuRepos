let controller = null;

module.exports = {
  setDownloadsController(ctrl) {
    controller = ctrl;
  },
  getDownloadsController() {
    return controller;
  }
};
