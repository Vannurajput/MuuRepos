let isDebugEnabled = true;

export const setDebugMode = (isEnabled: boolean) => {
  isDebugEnabled = isEnabled;
  console.log(`[LOGGER] Debug mode is now ${isEnabled ? 'ENABLED' : 'DISABLED'}.`);
};

export const logger = {
  debug: (...args: any[]) => {
    if (isDebugEnabled) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
  info: (...args: any[]) => {
    console.info('[INFO]', new Date().toISOString(), ...args);
  },
  warn: (...args: any[]) => {
    console.warn('[WARN]', new Date().toISOString(), ...args);
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },
};
