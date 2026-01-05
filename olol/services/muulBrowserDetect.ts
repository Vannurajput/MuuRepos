
export async function detectMuulBrowser(): Promise<boolean> {
  console.log('[MessageHandler] Starting Muul Browser detection...');
  if (!window.externalMessage?.send) {
    console.warn('[MessageHandler] Bridge `window.externalMessage.send` not found.');
    return false;
  }

  try {
    const payload = {
      type: "MUULORIGIN",
      href: window.location.href,
      ts: Date.now(),
    };
    console.log('[MessageHandler] Sending detection payload:', payload);
    const response = await window.externalMessage.send(JSON.stringify(payload));

    const isMuul = response?.ok === true && response?.isMuulorigin === true;
    console.log(`[MessageHandler] Detection result: ${isMuul ? 'SUCCESS' : 'FAILURE'}`, response);
    return isMuul;
  } catch (error) {
    console.error("[MessageHandler] Muul Browser detection failed with error:", error);
    return false;
  }
}
