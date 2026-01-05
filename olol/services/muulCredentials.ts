
import { CredentialEntry } from '../types';

/**
 * Fetches saved database credentials from the Muul Browser bridge.
 * @returns A promise that resolves to an array of CredentialEntry objects.
 */
export async function fetchSavedCredentials(): Promise<CredentialEntry[]> {
  console.log('[MessageHandler] Attempting to fetch saved credentials...');
  if (!window.externalMessage?.send) {
    console.warn("[MessageHandler] Bridge not detected. Cannot fetch credentials.");
    return [];
  }

  try {
    const requestPayload = {
      type: "GET_SAVED_CREDENTIALS",
      requestId: `list-${Date.now()}`
    };
    
    console.log("[MessageHandler] Sending request:", requestPayload);
    const response = await window.externalMessage.send(JSON.stringify(requestPayload));
    console.log("[MessageHandler] Received response for credentials:", response);

    if (response && response.ok) {
      // Handle response structures where entries are at the root or nested under `data`
      const entries = response.entries || response.data?.entries;
      if (Array.isArray(entries)) {
        console.log(`[MessageHandler] Successfully parsed ${entries.length} credentials.`);
        return entries;
      } else {
        console.warn("[MessageHandler] Fetched credentials but 'entries' array is missing or not an array.", response);
        return [];
      }
    }
    
    console.error("[MessageHandler] Failed to fetch credentials or received an invalid response format:", response);
    return [];
  } catch (error) {
    console.error("[MessageHandler] Error occurred while fetching saved credentials:", error);
    return [];
  }
}
