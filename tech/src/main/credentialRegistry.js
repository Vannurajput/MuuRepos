const fs = require('fs/promises');
const path = require('path');
const os = require('os');

// Allow running outside Electron (e.g., scheduler service) by falling back to a safe app.getPath.
let app;
let electronModule;
try {
  electronModule = require('electron');
} catch (_) {}

app =
  electronModule?.app && typeof electronModule.app.getPath === 'function'
    ? electronModule.app
    : {
        getPath(name) {
          if (name === 'userData') return path.join(os.homedir(), 'AppData', 'Roaming', 'MuulBrowser');
          if (name === 'appData') return path.join(os.homedir(), 'AppData', 'Roaming');
          return path.join(os.homedir(), 'AppData', 'Roaming', 'MuulBrowser');
        }
      };

const REGISTRY_FILE = path.join(app.getPath('userData'), 'credential-registry.json');

const defaultRegistry = {
  git: [],
  database: [],
  other: [],
  printer: []
};

const safeType = (type) => {
  if (type === 'git' || type === 'database' || type === 'other' || type === 'printer') {
    return type;
  }
  return null;
};

async function readRegistry() {
  try {
    const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      git: Array.isArray(data.git) ? data.git : [],
      database: Array.isArray(data.database) ? data.database : [],
      other: Array.isArray(data.other) ? data.other : [],
      printer: Array.isArray(data.printer) ? data.printer : []
    };
  } catch {
    return JSON.parse(JSON.stringify(defaultRegistry));
  }
}

async function writeRegistry(data) {
  await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const generateId = (type = 'entry') => `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function listAll() {
  const data = await readRegistry();
  return {
    git: [...data.git],
    database: [...data.database],
    other: [...data.other],
    printer: [...data.printer]
  };
}

async function list(type) {
  const data = await readRegistry();
  const key = safeType(type);
  if (!key) return [];
  return [...data[key]];
}

async function get(type, id) {
  const data = await readRegistry();
  const key = safeType(type);
  if (!key || !id) return null;
  return data[key].find((entry) => entry.id === id) || null;
}

async function upsert(type, entry = {}) {
  const key = safeType(type);
  if (!key) {
    throw new Error(`Unknown credential type: ${type}`);
  }
  const data = await readRegistry();
  const payload = {
    ...entry,
    type: key,
    id: entry.id || generateId(key),
    updatedAt: Date.now(),
    createdAt: entry.createdAt || Date.now()
  };
  const target = data[key];
  if (key === 'database') {
    const normalizedName = (payload.database || payload.label || '')
      .trim()
      .toLowerCase();
    if (normalizedName) {
      const duplicate = target.find(
        (item) =>
          item.id !== payload.id &&
          (item.database || item.label || '').trim().toLowerCase() === normalizedName
      );
      if (duplicate) {
        const error = new Error(`Database credential "${payload.database || payload.label}" already exists.`);
        error.code = 'CREDENTIAL_DUPLICATE';
        throw error;
      }
    }
  }
  if (key === 'printer') {
    const normalizedDevice = (payload.deviceName || payload.label || '')
      .trim()
      .toLowerCase();
    if (normalizedDevice) {
      const duplicate = target.find(
        (item) =>
          item.id !== payload.id &&
          ((item.deviceName || item.label || '').trim().toLowerCase() === normalizedDevice)
      );
      if (duplicate) {
        const error = new Error(`Printer "${payload.deviceName || payload.label}" already exists.`);
        error.code = 'CREDENTIAL_DUPLICATE';
        throw error;
      }
    }
  }
  const index = target.findIndex((item) => item.id === payload.id);
  if (index >= 0) {
    target[index] = payload;
  } else {
    target.push(payload);
  }
  await writeRegistry(data);
  return payload;
}

async function remove(type, id) {
  const key = safeType(type);
  if (!key || !id) return false;
  const data = await readRegistry();
  const target = data[key];
  const index = target.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return false;
  }
  target.splice(index, 1);
  await writeRegistry(data);
  return true;
}

async function clearAll() {
  await writeRegistry(JSON.parse(JSON.stringify(defaultRegistry)));
}

module.exports = {
  listAll,
  list,
  get,
  upsert,
  remove,
  clearAll
};
