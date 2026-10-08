import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { saveGeminiKey, fetchGeminiKey, saveGeminiModel, fetchGeminiModel, addUser, removeUser } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import { sha256Hex } from "@/lib/auth";
import { FULL_ACCESS_ROLES } from "@/lib/role-filter";
import { ConfirmDialog } from "./ConfirmDialog";
import { UserPlus, Trash2, Loader2, Settings2, Bot, Users, Smartphone, Key, Moon, Sun, KeyRound } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

type UserEntry = { name: string; username: string; role: string };

const ROLE_OPTIONS = ["User", "System Manager", "Owner", "HR", "Accounts"];

type Props = {
  user: SessionUser;
  users: UserEntry[];
  onClose: () => void;
  onRefresh: () => void;
  onChangePassword?: () => void;
};

function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "••••••••" : "Not set";
  return key.slice(0, 4) + "••••••••••••" + key.slice(-4);
}

export function SettingsModal({ user, users, onClose, onRefresh, onChangePassword }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = FULL_ACCESS_ROLES.includes((user.role || "").trim().toLowerCase());
  const [editing, setEditing] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [currentKey, setCurrentKey] = useState<string>("");
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyLoadError, setKeyLoadError] = useState<string | null>(null);

  const [currentModel, setCurrentModel] = useState<string>("");
  const [modelLoading, setModelLoading] = useState(true);
  const [editingModel, setEditingModel] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [savingModel, setSavingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelSuccess, setModelSuccess] = useState(false);

  // ── Manage Users state ──────────────────────────────────────────
  const [showAddUser, setShowAddUser] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState(ROLE_OPTIONS[0]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  const [removingUser, setRemovingUser] = useState<UserEntry | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const [activeTab, setActiveTab] = useState<"preferences" | "ai" | "users">("preferences");
  const [enableSwipe, setEnableSwipe] = useState(() => localStorage.getItem("enableSwipe") !== "false");

  const handleToggleSwipe = () => {
    const next = !enableSwipe;
    setEnableSwipe(next);
    localStorage.setItem("enableSwipe", String(next));
  };

  useEffect(() => {
    let cancelled = false;

    setKeyLoading(true);
    fetchGeminiKey()
      .then((key) => { if (!cancelled) setCurrentKey(key); })
      .catch((err) => { if (!cancelled) setKeyLoadError((err as Error).message); })
      .finally(() => { if (!cancelled) setKeyLoading(false); });

    setModelLoading(true);
    fetchGeminiModel()
      .then((model) => { if (!cancelled) setCurrentModel(model); })
      .catch(() => { if (!cancelled) setCurrentModel("gemini-3.1-flash-lite"); })
      .finally(() => { if (!cancelled) setModelLoading(false); });

    return () => { cancelled = true; };
  }, []);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) { setError("Key cannot be empty"); return; }
    setSaving(true); setError(null);
    try {
      await saveGeminiKey(newKey.trim());
      setCurrentKey(newKey.trim());
      setSuccess(true);
      setEditing(false);
      setNewKey("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveModel(e: React.FormEvent) {
    e.preventDefault();
    if (!newModel.trim()) { setModelError("Model name cannot be empty"); return; }
    setSavingModel(true); setModelError(null);
    try {
      await saveGeminiModel(newModel.trim());
      setCurrentModel(newModel.trim());
      setModelSuccess(true);
      setEditingModel(false);
      setNewModel("");
    } catch (err) {
      setModelError((err as Error).message);
    } finally {
      setSavingModel(false);
    }
  }

  const resetAddUserForm = () => {
    setFirstName("");
    setLastName("");
    setNewUserPassword("");
    setNewUserRole(ROLE_OPTIONS[0]);
    setNewUserEmail("");
    setAddUserError(null);
  };

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setAddUserError("First and last name are required.");
      return;
    }
    if (!newUserPassword.trim()) {
      setAddUserError("Password is required.");
      return;
    }
    setAddingUser(true);
    setAddUserError(null);
    setCreatedUsername(null);
    try {
      const hashed = await sha256Hex(newUserPassword.trim());
      const username = await addUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: hashed,
        role: newUserRole,
        email: newUserEmail.trim(),
      });
      setCreatedUsername(username);
      resetAddUserForm();
      onRefresh();
    } catch (err) {
      setAddUserError((err as Error).message);
    } finally {
      setAddingUser(false);
    }
  }

  async function runRemoveUser() {
    if (!removingUser) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      await removeUser(removingUser.username);
      setRemovingUser(null);
      onRefresh();
    } catch (err) {
      setRemoveError((err as Error).message);
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-0 shadow-card flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-bold text-accent flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t("settings.title")}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {isAdmin && (
          <div className="flex px-4 pt-3 gap-4 border-b border-border text-sm font-semibold text-muted-foreground">
            <button
              onClick={() => setActiveTab("preferences")}
              className={`pb-2 border-b-2 transition-colors ${activeTab === "preferences" ? "border-accent text-accent" : "border-transparent hover:text-foreground"}`}
            >
              Preferences
            </button>
            <button
              onClick={() => setActiveTab("ai")}
              className={`pb-2 border-b-2 transition-colors ${activeTab === "ai" ? "border-accent text-accent" : "border-transparent hover:text-foreground"}`}
            >
              AI config
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2 border-b-2 transition-colors ${activeTab === "users" ? "border-accent text-accent" : "border-transparent hover:text-foreground"}`}
            >
              Users
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto">
          {activeTab === "preferences" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("settings.language")}
                </p>
                <p className="mb-2 text-[11px] text-muted-foreground">{t("settings.language_desc")}</p>
                <select
                  value={i18n.language || "en"}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                </select>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Navigation
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Swipe Navigation</p>
                      <p className="text-[11px] text-muted-foreground">Swipe left/right to change tabs</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSwipe}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${enableSwipe ? 'bg-accent' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${enableSwipe ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Appearance & Security
                </p>
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium text-foreground">Theme</p>
                        <p className="text-[11px] text-muted-foreground">Toggle dark or light appearance</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                    >
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </button>
                  </div>
                  
                  {onChangePassword && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Password</p>
                          <p className="text-[11px] text-muted-foreground">Update your account password</p>
                        </div>
                      </div>
                      <button
                        onClick={onChangePassword}
                        className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors shadow-sm"
                      >
                        Change Password
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!isAdmin && (
                <p className="mt-4 text-xs text-muted-foreground">Only System Managers, Owners, HR, and Accounts can update system settings.</p>
              )}
            </div>
          )}

          {isAdmin && activeTab === "ai" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="mb-4">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" />
                    {t("settings.gemini_key")}
                  </p>
                  {keyLoading ? (
                    <p className="text-sm text-muted-foreground">Checking shared key…</p>
                  ) : keyLoadError ? (
                    <p className="text-sm text-destructive">Could not check shared key: {keyLoadError}</p>
                  ) : (
                    <p className="font-mono text-sm text-foreground">{maskKey(currentKey)}</p>
                  )}
                  {success && <p className="mt-1 text-xs text-green-600">Key saved successfully!</p>}
                </div>

                {!editing ? (
                  <button
                    onClick={() => { setEditing(true); setSuccess(false); }}
                    className="w-full rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
                  >
                    Update API Key
                  </button>
                ) : (
                  <form onSubmit={handleSaveKey}>
                    <input
                      type="text"
                      placeholder="Paste new Gemini API key"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(false); setNewKey(""); setError(null); }}
                        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="border-t border-border pt-5">
                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  Gemini Model
                </p>
                {modelLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <p className="font-mono text-sm text-foreground mb-4">{currentModel}</p>
                )}
                {modelSuccess && <p className="mt-1 text-xs text-green-600">Model saved successfully!</p>}

                {!editingModel ? (
                  <button
                    onClick={() => { setEditingModel(true); setModelSuccess(false); setNewModel(currentModel); }}
                    className="w-full rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
                  >
                    Update Model
                  </button>
                ) : (
                  <form onSubmit={handleSaveModel}>
                    <input
                      type="text"
                      placeholder="e.g. gemini-3.1-flash-lite"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Enter the exact Gemini model string. Default fallback: gemini-3.1-flash-lite
                    </p>
                    {modelError && <p className="mb-2 text-xs text-destructive">{modelError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingModel(false); setNewModel(""); setModelError(null); }}
                        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingModel}
                        className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                      >
                        {savingModel ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {isAdmin && activeTab === "users" && (
            <div className="animate-fade-in">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Manage Users
              </p>

              <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-border">
                {users.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">No users yet.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {users.map((u) => (
                      <div key={u.username} className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/30 transition-colors">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{u.name}</div>
                          <div className="text-muted-foreground">{u.username} · {u.role}</div>
                        </div>
                        <button
                          onClick={() => setRemovingUser(u)}
                          className="shrink-0 text-destructive hover:opacity-70 p-1.5"
                          aria-label="Remove user"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!showAddUser ? (
                <button
                  onClick={() => { setShowAddUser(true); setCreatedUsername(null); }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent bg-accent/5 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft transition-colors"
                >
                  <UserPlus className="h-4 w-4" /> Add New User
                </button>
              ) : (
                <form onSubmit={handleAddUser} className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  {addUserError && <p className="text-xs text-destructive">{addUserError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowAddUser(false); resetAddUserForm(); }}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingUser}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                    >
                      {addingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {addingUser ? "Adding…" : "Add"}
                    </button>
                  </div>
                </form>
              )}

              {createdUsername && (
                <div className="mt-3 rounded-lg bg-accent-soft border border-accent/20 p-3 text-xs">
                  <div className="font-semibold text-accent flex items-center gap-1.5">
                    <span>✅</span> User created
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Username: <span className="font-mono font-semibold text-foreground">{createdUsername}</span> — share this and the password with them so they can log in.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!removingUser}
        title="Remove this user?"
        message={`This permanently deletes "${removingUser?.name || ""}" (${removingUser?.username || ""}) from User Details. They will no longer be able to log in. This can't be undone.`}
        confirmLabel="Remove permanently"
        destructive
        loading={removeLoading}
        error={removeError}
        onConfirm={runRemoveUser}
        onCancel={() => { setRemovingUser(null); setRemoveError(""); }}
      />
    </div>
  );
}