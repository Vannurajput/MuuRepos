/**
 * bookmarkStore.js
 * Keeps track of saved bookmarks with basic toggle helpers.
 * Now persisted to disk so bookmarks survive app restarts.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_BOOKMARKS = 100;
const DEFAULT_FOLDER = 'bar';
const VALID_FOLDERS = new Set(['bar', 'other']);
const bookmarkFile = () => path.join(app.getPath('userData'), 'bookmarks.json');

class BookmarkStore {
  constructor() {
    this.items = []; // newest-first bookmark list
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      const file = bookmarkFile();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.items = parsed.slice(0, MAX_BOOKMARKS);
        }
      }
    } catch (_) {
      this.items = [];
    }
  }

  persist() {
    try {
      fs.writeFileSync(bookmarkFile(), JSON.stringify(this.items, null, 2), 'utf-8');
    } catch (_) {
      // best-effort only
    }
  }

  normalize(entry = {}) {
    if (!entry.url) return null;
    const title = entry.title?.trim() || entry.url;
    const folder = VALID_FOLDERS.has((entry.folder || '').toLowerCase())
      ? entry.folder.toLowerCase()
      : DEFAULT_FOLDER;
    const createdAt = entry.createdAt || entry.timestamp || Date.now();
    return {
      id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      url: entry.url,
      folder,
      favicon: entry.favicon || entry.favIconUrl || null,
      createdAt,
      timestamp: entry.timestamp || createdAt
    };
  }

  // Adds a bookmark if it is not already present.
  add(entry) {
    const normalized = this.normalize(entry);
    if (!normalized) return null;
    if (this.items.some((item) => item.url === normalized.url && item.folder === normalized.folder)) {
      return null;
    }
    this.items.unshift(normalized);
    if (this.items.length > MAX_BOOKMARKS) {
      this.items.length = MAX_BOOKMARKS;
    }
    this.persist();
    return normalized;
  }

  upsert(entry) {
    const normalized = this.normalize(entry);
    if (!normalized) return null;
    let index = -1;
    if (entry.id) {
      index = this.items.findIndex((item) => item.id === entry.id);
    } else {
      index = this.items.findIndex(
        (item) => item.url === normalized.url && item.folder === normalized.folder
      );
    }
    if (index >= 0) {
      const updated = {
        ...this.items[index],
        title: normalized.title,
        folder: normalized.folder,
        timestamp: normalized.timestamp
      };
      this.items.splice(index, 1);
      this.items.unshift(updated);
      this.persist();
      return updated;
    }
    this.items.unshift(normalized);
    if (this.items.length > MAX_BOOKMARKS) {
      this.items.length = MAX_BOOKMARKS;
    }
    this.persist();
    return normalized;
  }

  // Removes a bookmark by id/folder/url combo.
  remove(target) {
    if (!target) return false;
    const before = this.items.length;
    if (typeof target === 'string') {
      this.items = this.items.filter((item) => item.url !== target);
      const changed = before !== this.items.length;
      if (changed) this.persist();
      return changed;
    }
    const { id, url, folder } = target;
    this.items = this.items.filter((item) => {
      if (id && item.id === id) {
        return false;
      }
      if (url) {
        if (folder) {
          return !(item.url === url && item.folder === folder);
        }
        return item.url !== url;
      }
      return true;
    });
    const changed = before !== this.items.length;
    if (changed) this.persist();
    return changed;
  }

  // Toggles bookmark state for the provided entry.
  toggle(entry) {
    if (!entry || !entry.url) {
      return false;
    }
    const exists = this.items.some((item) => item.url === entry.url);
    if (exists) {
      const changed = this.remove(entry.url);
      return !changed ? false : false;
    }
    this.add(entry);
    return true;
  }

  // Drops all bookmarks.
  clear() {
    this.items = [];
    this.persist();
  }

  // Returns a copy for renderer consumption.
  getAll() {
    return [...this.items];
  }
}

module.exports = new BookmarkStore();
