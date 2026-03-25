/**
 * historyStore.js
 * Lightweight navigation history tracker with disk persistence.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_HISTORY_ITEMS = 50;
const historyFile = () => path.join(app.getPath('userData'), 'history.json');

class HistoryStore {
  constructor() {
    this.entries = []; // holds latest navigation entries
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      const file = historyFile();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(0, MAX_HISTORY_ITEMS);
        }
      }
    } catch (_) {
      this.entries = [];
    }
  }

  persist() {
    try {
      fs.writeFileSync(historyFile(), JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (_) {
      // best-effort; ignore disk write errors
    }
  }

  // Normalizes entries and limits the list length.
  addEntry(entry) {
    if (!entry || !entry.url) {
      return;
    }

    // Ignore local file navigations (e.g., internal UI pages)
    if (entry.url.startsWith('file://')) {
      return;
    }

    // Skip if the last stored entry has the same URL (avoid rapid duplicates)
    if (this.entries.length && this.entries[0].url === entry.url) {
      return;
    }

    const normalized = {
      // generate a loose unique id so we can track and remove entries if needed
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: entry.title || entry.url,
      url: entry.url,
      timestamp: entry.timestamp || Date.now()
    };

    this.entries.unshift(normalized);

    if (this.entries.length > MAX_HISTORY_ITEMS) {
      this.entries.length = MAX_HISTORY_ITEMS;
    }

    this.persist();
  }

  // Returns a snapshot for UI rendering.
  getHistory() {
    return [...this.entries]; // return a shallow copy so callers cannot mutate internal state
  }

  // Drops stored history.
  clear() {
    this.entries = []; // drop everything for a clean slate
    this.persist();
  }
}

module.exports = new HistoryStore();
