declare global {
  interface Window {
    externalMessage?: {
      send: (jsonText: string) => Promise<any>;
      onResult?: (cb: (payload: any) => void) => () => void;
    };
  }
}

export {};
