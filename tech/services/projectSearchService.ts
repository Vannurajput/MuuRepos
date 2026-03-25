export const workerCode = `
const globToRegex = (glob) => {
  const specialChars = '\\\\^$*+?.()|{}[]';
  let regexString = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*') {
      regexString += '.*';
    } else if (specialChars.includes(char)) {
      regexString += '\\\\' + char;
    } else {
      regexString += char;
    }
  }
  // We don't anchor with ^ and $ to allow for path matching, e.g., 'dist/*' should match 'dist/bundle.js'
  return new RegExp(regexString);
};

self.onmessage = ({ data }) => {
  const { files, query, options } = data;
  const { isCaseSensitive, isWholeWord, include, exclude } = options;

  const results = [];
  if (!query) {
    self.postMessage({ results: [] });
    return;
  }

  const includePatterns = include ? include.split(',').map(p => p.trim()).filter(Boolean).map(globToRegex) : [];
  const excludePatterns = exclude ? exclude.split(',').map(p => p.trim()).filter(Boolean).map(globToRegex) : [];

  let searchRegex;
  try {
    const queryForRegex = query.replace(/[.*+?^$(){}|[\\]\\\\]/g, '\\\\$&');
    searchRegex = new RegExp(
      isWholeWord ? '\\\\b' + queryForRegex + '\\\\b' : queryForRegex,
      isCaseSensitive ? 'g' : 'gi'
    );
  } catch (e) {
    self.postMessage({ results: [] }); // Invalid regex in query
    return;
  }
  

  for (const file of files) {
    if (file.isBinary || file.name.endsWith('.placeholder')) continue;

    // Filter by include/exclude patterns
    if (includePatterns.length > 0 && !includePatterns.some(p => p.test(file.name))) {
      continue;
    }
    if (excludePatterns.length > 0 && excludePatterns.some(p => p.test(file.name))) {
      continue;
    }

    const lines = file.content.split('\\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (searchRegex.test(line)) {
        results.push({
          fileName: file.name,
          lineNumber: i + 1,
          lineContent: line.trim(),
        });
      }
      searchRegex.lastIndex = 0; // Reset regex state
    }
  }
  self.postMessage({ results });
};
`;

export function createSearchWorker() {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
}
