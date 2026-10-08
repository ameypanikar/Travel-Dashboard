// Client-side field encryption for Notes & Reminders. The key is derived from
// the user's password (never sent to the server) and cached in localStorage
// alongside the session, so it survives refreshes/restarts the same way login
// already does. Apps Script/the sheet only ever sees ciphertext for these fields.

const KEY_STORAGE_KEY = "notes_encryption_key";

async function deriveKey(password: string, username: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(`travel-dashboard-notes-${username.trim().toLowerCase()}`),
      iterations: 150000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function exportKeyToStorage(key: CryptoKey): Promise<void> {
  const raw = await crypto.subtle.exportKey("raw", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
  localStorage.setItem(KEY_STORAGE_KEY, b64);
}

async function importKeyFromStorage(): Promise<CryptoKey | null> {
  const b64 = localStorage.getItem(KEY_STORAGE_KEY);
  if (!b64) return null;
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Called on login/signup — derives and caches the key for this session.
export async function setupEncryptionKey(password: string, username: string): Promise<void> {
  const key = await deriveKey(password, username);
  await exportKeyToStorage(key);
}

// Called on logout — the key should not persist beyond the session.
export function clearEncryptionKey(): void {
  localStorage.removeItem(KEY_STORAGE_KEY);
}

async function encryptWith(key: CryptoKey, plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptWith(key: CryptoKey, ciphertextB64: string): Promise<string> {
  if (!ciphertextB64) return "";
  try {
    const combined = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch {
    return "⚠️ Unreadable (encrypted under a different password)";
  }
}

// ── Public API used by dashboard-api.ts and the hook ───────────────────────
export async function encryptField(plaintext: string): Promise<string> {
  const key = await importKeyFromStorage();
  if (!key) throw new Error("Encryption key not available — please log in again.");
  return encryptWith(key, plaintext);
}

export async function decryptField(ciphertextB64: string): Promise<string> {
  const key = await importKeyFromStorage();
  if (!key) return "🔒 Log in again to view";
  return decryptWith(key, ciphertextB64);
}

// ── Used only by changePassword, which needs both keys simultaneously
// to re-encrypt existing rows before the new key replaces the cached one. ──
export async function deriveKeyForReencryption(password: string, username: string): Promise<CryptoKey> {
  return deriveKey(password, username);
}
export async function encryptFieldWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  return encryptWith(key, plaintext);
}
export async function decryptFieldWithKey(key: CryptoKey, ciphertextB64: string): Promise<string> {
  return decryptWith(key, ciphertextB64);
}
export async function cacheKey(key: CryptoKey): Promise<void> {
  await exportKeyToStorage(key);
}