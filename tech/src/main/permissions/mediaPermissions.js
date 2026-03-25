/**
 * mediaPermissions.js
 * Grant camera/mic for trusted origins; deny everything else.
 */
const { URL } = require('url');

// Allow https, file://, and localhost/127.0.0.1
const isTrustedOrigin = (origin = '') => {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.protocol === 'file:') return true;
    if (u.protocol === 'https:') return true;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  } catch (_) {}
  return false;
};

const registerMediaPermissionHandler = (ses) => {
  if (!ses) return;

  const ALLOWED = new Set(['media', 'videoCapture', 'audioCapture', 'fullscreen']);

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    // Allow fullscreen globally
    if (permission === 'fullscreen') {
      callback(true);
      return;
    }

    if (!ALLOWED.has(permission)) {
      callback(false);
      return;
    }
    const origin = details?.requestingUrl || webContents?.getURL?.() || '';
    const allow = isTrustedOrigin(origin);
    callback(allow);
  });

  if (typeof ses.setPermissionCheckHandler === 'function') {
    ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (permission === 'fullscreen') return true;
      if (!ALLOWED.has(permission)) return false;
      const origin = requestingOrigin || webContents?.getURL?.() || '';
      return isTrustedOrigin(origin);
    });
  }
};

module.exports = {
  registerMediaPermissionHandler
};
