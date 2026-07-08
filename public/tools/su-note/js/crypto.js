/* WebCrypto-based API key encryption.
 *
 * - PBKDF2(SHA-256, 200k iter) derives an AES-GCM key from the user passphrase.
 * - Each stored key gets its own random IV.
 * - localStorage holds only ciphertext + salt + IVs. The passphrase is never
 *   persisted; it lives in memory (window.__sunoKey) until the tab closes,
 *   or, if the user opts in, in sessionStorage as the derived raw bytes.
 */
(function () {
  'use strict';

  const STORE_KEY = 'suno_api_v1';
  const SESSION_KEY = 'suno_session_key';
  const LOCAL_KEY = 'suno_device_key';     // persistent unlock state
  const ITER = 200000;

  function b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

  async function deriveKey(passphrase, saltBytes) {
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: ITER, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptValue(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
    );
    return { iv: b64(iv), ct: b64(ct) };
  }

  async function decryptValue(key, payload) {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.ct)
    );
    return new TextDecoder().decode(pt);
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
    catch { return null; }
  }
  function saveStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  // Auto-generate and persist a random AES-GCM key the first time we're
  // asked, then re-import it on subsequent calls. No user passphrase is
  // ever requested — the convenience trade-off the user explicitly chose.
  async function ensureDeviceKey() {
    let raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const exported = await crypto.subtle.exportKey('raw', key);
      raw = b64(exported);
      localStorage.setItem(LOCAL_KEY, raw);
      // Bootstrap an empty store so future setKeys / getKey calls work.
      if (!loadStore()) {
        saveStore({ version: 2, mode: 'device', provider: 'anthropic', models: {}, keys: {} });
      }
      return key;
    }
    return crypto.subtle.importKey(
      'raw', unb64(raw), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
  }

  // public API
  const Vault = {
    hasStore() { return !!loadStore(); },

    /** Bootstrap & return the device-bound CryptoKey (used by the app on boot). */
    bootstrapKey: ensureDeviceKey,

    /** Unlock or create the vault. Returns the derived CryptoKey on success. */
    async unlock(passphrase, { remember = false } = {}) {
      let store = loadStore();
      let salt;
      if (store) {
        salt = unb64(store.salt);
      } else {
        salt = crypto.getRandomValues(new Uint8Array(16));
        store = { version: 1, salt: b64(salt), provider: 'anthropic', models: {}, keys: {} };
        saveStore(store);
      }
      const key = await deriveKey(passphrase, salt);

      // verify by decrypting any existing key — if none, the unlock is implicit.
      const probeName = Object.keys(store.keys || {})[0];
      if (probeName) {
        try { await decryptValue(key, store.keys[probeName]); }
        catch { throw new Error('암호가 일치하지 않습니다.'); }
      }

      // Once a passphrase successfully unlocks the vault, persist the
      // derived key on the device so subsequent visits skip the prompt
      // until the user explicitly resets. The `remember` flag (legacy
      // sessionStorage) is kept for backwards compatibility.
      const raw = await crypto.subtle.exportKey('raw', key);
      localStorage.setItem(LOCAL_KEY, b64(raw));
      if (remember) sessionStorage.setItem(SESSION_KEY, b64(raw));
      return key;
    },

    /** Re-import a persistent device key (call on page load).
     *  Falls back to the legacy sessionStorage location for compat. */
    async restoreSessionKey() {
      const raw = localStorage.getItem(LOCAL_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return crypto.subtle.importKey(
        'raw', unb64(raw), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
      );
    },

    forgetSessionKey() {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LOCAL_KEY);
    },

    /** Save one or more API keys (object: { provider: keyString }). Empty strings remove. */
    async setKeys(cryptoKey, keys) {
      const store = loadStore() || { version: 1, salt: '', keys: {} };
      for (const [prov, val] of Object.entries(keys)) {
        if (!val) { delete store.keys[prov]; continue; }
        store.keys[prov] = await encryptValue(cryptoKey, val);
      }
      saveStore(store);
    },

    async getKey(cryptoKey, provider) {
      const store = loadStore();
      if (!store || !store.keys?.[provider]) return null;
      return decryptValue(cryptoKey, store.keys[provider]);
    },

    async listKeys(cryptoKey) {
      const store = loadStore();
      if (!store) return {};
      const out = {};
      for (const [prov, payload] of Object.entries(store.keys || {})) {
        try { out[prov] = await decryptValue(cryptoKey, payload); }
        catch { out[prov] = null; }
      }
      return out;
    },

    setMeta(meta) {
      const store = loadStore() || { version: 1, salt: '', keys: {} };
      Object.assign(store, meta);
      saveStore(store);
    },
    getMeta() {
      const s = loadStore();
      if (!s) return { provider: 'anthropic', models: {} };
      return { provider: s.provider || 'anthropic', models: s.models || {} };
    },

    reset() {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(LOCAL_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    },
  };

  window.SunoVault = Vault;
})();
