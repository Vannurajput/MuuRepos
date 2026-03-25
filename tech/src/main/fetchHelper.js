let cachedFetch = null;

const resolveFetch = async () => {
  if (typeof fetch === 'function') {
    return fetch.bind(global);
  }
  if (!cachedFetch) {
    const module = await import('node-fetch');
    cachedFetch = module.default;
  }
  return cachedFetch;
};

module.exports = { resolveFetch };
