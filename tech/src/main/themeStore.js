const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const THEME_FILE = () => path.join(app.getPath('userData'), 'theme-config.json');
const DEFAULT_THEME = {
  color: '#2563eb'
};

async function readThemeFile() {
  try {
    const raw = await fs.readFile(THEME_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_THEME,
      ...parsed
    };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

async function writeThemeFile(theme = DEFAULT_THEME) {
  const payload = { ...DEFAULT_THEME, ...theme };
  await fs.mkdir(path.dirname(THEME_FILE()), { recursive: true });
  await fs.writeFile(THEME_FILE(), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

module.exports = {
  DEFAULT_THEME,
  readThemeFile,
  writeThemeFile
};
