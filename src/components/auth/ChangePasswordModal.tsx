import { useState } from "react";
import { changePassword, adminResetPassword, type SessionUser } from "@/lib/auth";

type Props = {
  user: SessionUser;
  allUsers?: { name: string; username: string; role: string }[];
  onClose: () => void;
};

export function ChangePasswordModal({ user, allUsers = [], onClose }: Props) {
  const isAdmin = user.role === "System Manager" || user.role === "Owner";

  // Own password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [selfError, setSelfError] = useState<string | null>(null);
  const [selfSuccess, setSelfSuccess] = useState(false);
  const [selfLoading, setSelfLoading] = useState(false);

  // Admin reset
  const [targetUser, setTargetUser] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleSelfChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setSelfError("Passwords don't match"); return; }
    if (newPw.length < 6) { setSelfError("Password must be at least 6 characters"); return; }
    setSelfLoading(true); setSelfError(null);
    try {
      await changePassword(user.username, currentPw, newPw);
      setSelfSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setSelfError((err as Error).message);
    } finally {
      setSelfLoading(false);
    }
  }

  async function handleAdminReset(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUser) { setAdminError("Select a user"); return; }
    if (resetPw.length < 6) { setAdminError("Password must be at least 6 characters"); return; }
    setAdminLoading(true); setAdminError(null);
    try {
      await adminResetPassword(targetUser, resetPw);
      setAdminSuccess(true);
      setTargetUser(""); setResetPw("");
    } catch (err) {
      setAdminError((err as Error).message);
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-accent">Password Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {/* Change own password */}
        <form onSubmit={handleSelfChange} className="mb-6">
          <h3 className="mb-3 text-sm font-semibold">Change My Password</h3>
          <input
            type="password"
            name="current-password"
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <input
            type="password"
            name="new-password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          {selfError && <p className="mb-2 text-xs text-destructive">{selfError}</p>}
          {selfSuccess && <p className="mb-2 text-xs text-green-600">Password changed successfully!</p>}
          <button
            type="submit"
            disabled={selfLoading}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {selfLoading ? "Saving…" : "Update Password"}
          </button>
        </form>

        {/* Admin reset section */}
        {isAdmin && allUsers.length > 0 && (
          <form onSubmit={handleAdminReset} className="border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold">Reset Another User's Password</h3>
            <select
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">Select user…</option>
              {allUsers
                .filter((u) => u.username !== user.username)
                .map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.name} ({u.username})
                  </option>
                ))}
            </select>
            <input
              type="password"
              name="admin-new-password"
              autoComplete="new-password"
              placeholder="New password for user"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              required
              className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            {adminError && <p className="mb-2 text-xs text-destructive">{adminError}</p>}
            {adminSuccess && <p className="mb-2 text-xs text-green-600">Password reset successfully!</p>}
            <button
              type="submit"
              disabled={adminLoading}
              className="w-full rounded-lg bg-destructive/90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {adminLoading ? "Resetting…" : "Reset User Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}