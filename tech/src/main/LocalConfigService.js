const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const credentialRegistry = require('./credentialRegistry');

class LocalConfigService {
  getUserDataPath() {
    try {
      const p = app?.getPath?.('userData');
      if (p) return p;
    } catch (_) {
      /* fall through */
    }
    return process.cwd();
  }

  async getLocalConfig() {
    const userDataPath = this.getUserDataPath();
    const configPath = path.join(userDataPath, 'local-config.json');

    try {
      await fs.access(configPath);
    } catch (_) {
      // If the file does not exist, fall back to the credential registry.
      const fallback = await this.getLocalConfigFromRegistry();
      if (fallback) return fallback;
      return {};
    }

    try {
      const raw = await fs.readFile(configPath, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      const folderPath =
        parsed.folderPath || parsed.path || parsed.folder_path || parsed.folder || '';
      const folderName =
        parsed.folderName || parsed.name || parsed.folder_name || parsed.folder || '';
      if (folderPath || folderName) {
        return { folderPath, folderName };
      }
      // If file exists but has no usable fields, try registry before erroring out.
      const fallback = await this.getLocalConfigFromRegistry();
      if (fallback) return fallback;
      return {};
    } catch (error) {
      throw new Error(`Failed to read local config: ${error?.message || error}`);
    }
  }

  async getLocalConfigFromRegistry() {
    try {
      const entries = await credentialRegistry.list('other');
      if (!entries || !entries.length) return null;
      const candidate =
        entries.find(
          (item) =>
            item &&
            (item.localPath || item.secret || item.description || item.path) &&
            ((item.name || '').toLowerCase().includes('local') ||
              (item.label || '').toLowerCase().includes('local') ||
              (item.entrySource === 'registry' || item.entryType === 'other'))
        ) || entries.find((item) => item && (item.localPath || item.secret || item.description || item.path));

      if (!candidate) return null;

      const folderPath =
        candidate.localPath || candidate.secret || candidate.description || candidate.path || '';
      const folderName = candidate.name || candidate.label || '';

      if (!folderPath && !folderName) return null;
      return { folderPath, folderName };
    } catch (error) {
      return null;
    }
  }

  async getAllLocalConfigs() {
    try {
      const entries = await credentialRegistry.list('other');
      if (!entries || !entries.length) return [];

      // Filter entries that have a local path
      const localConfigs = entries
        .filter(
          (item) =>
            item &&
            (item.localPath || item.secret || item.description || item.path)
        )
        .map((item) => ({
          id: item.id,
          folderPath: item.localPath || item.secret || item.description || item.path || '',
          folderName: item.name || item.label || ''
        }))
        .filter((item) => item.folderPath);

      return localConfigs;
    } catch (error) {
      return [];
    }
  }

  async getFolderDetails() {
    const config = await this.getLocalConfig();
    const folderPath = config?.folderPath;

    if (!folderPath) {
      throw new Error('No folder path configured. Please save a folder path first.');
    }

    // Check if the folder exists
    try {
      await fs.access(folderPath);
    } catch (_) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    // Read directory contents
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const contents = [];

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      const item = {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: null
      };

      // Get file size (only for files, not folders)
      if (!entry.isDirectory()) {
        try {
          const stat = await fs.stat(entryPath);
          item.size = stat.size;
        } catch (_) {
          // If we can't get the size, leave it as null
        }
      }

      contents.push(item);
    }

    // Sort: folders first, then files, alphabetically
    contents.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      folderPath,
      folderName: config?.folderName || path.basename(folderPath),
      contents
    };
  }

  async getFolderDetailsForPath(folderPath, folderName = '', maxDepth = 10, currentDepth = 0) {
    if (!folderPath) {
      throw new Error('No folder path provided.');
    }

    // Check if the folder exists
    try {
      await fs.access(folderPath);
    } catch (_) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    // Skip node_modules and .git for performance (too many files)
    const skipFolders = ['node_modules', '.git'];
    const baseName = path.basename(folderPath);
    if (skipFolders.includes(baseName) && currentDepth > 0) {
      return {
        folderPath,
        folderName: folderName || baseName,
        contents: [],
        skipped: true,
        reason: 'Too many files (skipped for performance)'
      };
    }

    // Read directory contents
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const contents = [];

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      const item = {
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: null
      };

      if (entry.isDirectory()) {
        // Recursively get subfolder contents (if within depth limit)
        if (currentDepth < maxDepth) {
          try {
            const subfolderDetails = await this.getFolderDetailsForPath(
              entryPath,
              entry.name,
              maxDepth,
              currentDepth + 1
            );
            item.contents = subfolderDetails.contents;
            item.skipped = subfolderDetails.skipped;
            item.reason = subfolderDetails.reason;
          } catch (err) {
            item.contents = [];
            item.error = err?.message || 'Failed to read folder';
          }
        } else {
          item.contents = [];
          item.skipped = true;
          item.reason = 'Max depth reached';
        }
      } else {
        // Get file size
        try {
          const stat = await fs.stat(entryPath);
          item.size = stat.size;
        } catch (_) {
          // If we can't get the size, leave it as null
        }
      }

      contents.push(item);
    }

    // Sort: folders first, then files, alphabetically
    contents.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      folderPath,
      folderName: folderName || path.basename(folderPath),
      contents
    };
  }
}
module.exports = LocalConfigService;
