import { setupEncryptionKey, clearEncryptionKey } from "./note-crypto";
import { getSupabase } from "./supabase";

export type SessionUser = { name: string; username: string; role: string };

const USER_STORAGE_KEY = "travel_dashboard_user";
const TOKEN_STORAGE_KEY = "travel_dashboard_token";

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function setSession(user: SessionUser, token: string) {
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export async function clearSessionUser() {
  const token = getSessionToken();
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(USER_STORAGE_KEY);
  clearEncryptionKey();
  
  if (token) {
    try {
      await getSupabase().from('sessions').delete().eq('token', token);
    } catch {
      // ignore
    }
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function login(
  username: string,
  password: string,
): Promise<SessionUser> {
  const hashed = await sha256Hex(password);
  
  // Call the secure RPC to authenticate and generate a session token in one atomic step
  const { data, error } = await getSupabase().rpc('login_secure', { 
    p_username: username,
    p_password_plain: password,
    p_password_hash: hashed 
  });

  if (error || !data) {
    if (error?.message?.includes("Invalid username or password")) {
      throw new Error("Invalid username or password");
    }
    throw new Error(error?.message || "Could not reach login service");
  }
  
  const token = data.token;
  const sessionUser: SessionUser = { 
    name: data.name, 
    username: data.username, 
    role: data.role 
  };
 setSession(sessionUser, token);
  await setupEncryptionKey(password, sessionUser.username);
  return sessionUser;
}

export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await login(username, currentPassword);

  const { deriveKeyForReencryption, encryptFieldWithKey, decryptFieldWithKey, cacheKey } = await import("./note-crypto");
  const { fetchDashboard, updateNoteReminder } = await import("./dashboard-api");

  const oldKey = await deriveKeyForReencryption(currentPassword, username);
  const newKey = await deriveKeyForReencryption(newPassword, username);

  try {
    const data = await fetchDashboard();
    const mine = (data.notesReminders ?? []).filter(
      (n) => (n.username || "").trim().toLowerCase() === username.trim().toLowerCase(),
    );
    for (const item of mine) {
      const decrypted = {
        text: await decryptFieldWithKey(oldKey, item.text),
        category: await decryptFieldWithKey(oldKey, item.category),
      };
      const reEncrypted = {
        text: await encryptFieldWithKey(newKey, decrypted.text),
        category: await encryptFieldWithKey(newKey, decrypted.category),
      };
      await updateNoteReminder({ sourceRow: item.sourcerow, username, fields: reEncrypted });
    }
  } catch (e) {
    throw new Error(
      `Could not re-encrypt your notes for the new password: ${(e as Error).message}. Password was not changed — try again.`,
    );
  }

  const newHash = await sha256Hex(newPassword);
  
  const { error } = await getSupabase().from('users').update({ password: newHash }).ilike('username', username);
  
  if (error) throw new Error("Failed to update password");

  await cacheKey(newKey);
}

export async function adminResetPassword(
  targetUsername: string,
  newPassword: string,
): Promise<void> {
  const newHash = await sha256Hex(newPassword);
  const { error } = await getSupabase().from('users').update({ password: newHash }).ilike('username', targetUsername);
  
  if (error) throw new Error("Failed to reset password");
}