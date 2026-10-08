import { useEffect, useState } from "react";
import { login, sha256Hex, type SessionUser } from "@/lib/auth";
import { requestPasswordReset, resetPasswordWithToken } from "@/lib/dashboard-api";
import { Plane, Lock, User, Mail, ArrowLeft } from "lucide-react";

type Props = { onLogin: (user: SessionUser) => void };

type View = "login" | "forgot" | "reset";

export function LoginPage({ onLogin }: Props) {
  const [view, setView] = useState<View>("login");
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");
    if (token) {
      setResetToken(token);
      setView("reset");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      onLogin(user);
    } catch (err) {
      setError((err as Error).message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      await requestPasswordReset(forgotEmail.trim());
      setForgotSent(true);
    } catch (err) {
      setForgotError((err as Error).message || "Something went wrong. Try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    if (newPassword.length < 4) {
      setResetError("Password is too short.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords don't match.");
      return;
    }
    setResetLoading(true);
    try {
      const hashed = await sha256Hex(newPassword);
      await resetPasswordWithToken(resetToken || "", hashed);
      setResetDone(true);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setResetError((err as Error).message || "Could not reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  const bgGradient = {
    background: "linear-gradient(135deg, oklch(0.46 0.19 264) 0%, oklch(0.38 0.22 285) 40%, oklch(0.52 0.20 240) 100%)",
  };

  if (view === "reset") {
    return (
      <AuthShell bgGradient={bgGradient}>
        <AuthCard title="Set new password" subtitle="Choose a strong password for your account">
          {resetDone ? (
            <>
              <p className="mb-5 text-sm text-muted-foreground text-center">
                ✅ Your password has been updated. You can log in now.
              </p>
              <AuthButton onClick={() => { setView("login"); setResetToken(null); }}>
                Back to login
              </AuthButton>
            </>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <AuthField label="New password" icon={<Lock className="h-4 w-4" />}>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="auth-input"
                  placeholder="••••••••"
                />
              </AuthField>
              <AuthField label="Confirm new password" icon={<Lock className="h-4 w-4" />}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="auth-input"
                  placeholder="••••••••"
                />
              </AuthField>
              {resetError && <AuthError>{resetError}</AuthError>}
              <AuthButton type="submit" disabled={resetLoading}>
                {resetLoading ? "Saving…" : "Set password"}
              </AuthButton>
            </form>
          )}
        </AuthCard>
      </AuthShell>
    );
  }

  if (view === "forgot") {
    return (
      <AuthShell bgGradient={bgGradient}>
        <AuthCard title="Reset password" subtitle="Enter your account email and we'll send a reset link">
          {forgotSent ? (
            <>
              <p className="mb-5 text-sm text-muted-foreground text-center">
                📬 If that email is registered, a reset link has been sent. Check your inbox — it expires in 30 minutes.
              </p>
              <AuthButton onClick={() => { setView("login"); setForgotSent(false); setForgotEmail(""); }}>
                Back to login
              </AuthButton>
            </>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <AuthField label="Email" icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="auth-input"
                  placeholder="you@example.com"
                />
              </AuthField>
              {forgotError && <AuthError>{forgotError}</AuthError>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Cancel
                </button>
                <AuthButton type="submit" disabled={forgotLoading} className="flex-1">
                  {forgotLoading ? "Sending…" : "Send link"}
                </AuthButton>
              </div>
            </form>
          )}
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell bgGradient={bgGradient}>
      <AuthCard
        icon={
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: "linear-gradient(135deg, oklch(0.46 0.19 264), oklch(0.52 0.20 240))" }}
          >
            <Plane className="h-7 w-7 text-white" />
          </div>
        }
        title="Travel Dashboard"
        subtitle="Sign in to continue"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label="Username" icon={<User className="h-4 w-4" />}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="auth-input"
              placeholder="Enter your username"
            />
          </AuthField>

          <AuthField label="Password" icon={<Lock className="h-4 w-4" />}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="auth-input"
              placeholder="••••••••"
            />
          </AuthField>

          <div className="text-right -mt-2">
            <button
              type="button"
              onClick={() => setView("forgot")}
              className="text-xs font-medium text-accent hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {error && <AuthError>{error}</AuthError>}

          <AuthButton type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </AuthButton>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

/* ── Sub-components ── */

function AuthShell({ children, bgGradient }: { children: React.ReactNode; bgGradient: React.CSSProperties }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden" style={bgGradient}>
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20"
          style={{ background: "oklch(0.75 0.18 220)", filter: "blur(60px)" }} />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "oklch(0.38 0.22 285)", filter: "blur(80px)" }} />
        {/* Floating plane dots */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 600" preserveAspectRatio="none">
          <path d="M20 580 Q100 200 200 300 Q300 400 380 50" stroke="white" strokeWidth="1" fill="none" strokeDasharray="6 8" />
          <path d="M380 580 Q300 250 180 350 Q80 430 20 100" stroke="white" strokeWidth="0.8" fill="none" strokeDasharray="4 10" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {children}
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1.5px solid var(--color-input);
          background: var(--color-background);
          padding: 0.625rem 0.875rem 0.625rem 2.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
          color: var(--color-foreground);
        }
        .auth-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-ring);
        }
        .auth-input::placeholder {
          color: var(--color-muted-foreground);
        }
      `}</style>
    </div>
  );
}

function AuthCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl p-7 shadow-2xl bg-card/90 border border-border/60"
      style={{
        backdropFilter: "blur(24px) saturate(200%)",
        WebkitBackdropFilter: "blur(24px) saturate(200%)",
      }}
    >
      {icon && <div>{icon}</div>}
      <div className="mb-6 text-center">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function AuthField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function AuthButton({
  children,
  type = "button",
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all disabled:opacity-60 ${className}`}
      style={{
        background: "linear-gradient(135deg, oklch(0.46 0.19 264) 0%, oklch(0.52 0.20 240) 100%)",
        boxShadow: "0 4px 14px oklch(0.46 0.19 264 / 35%)",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = "0.9"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      {children}
    </button>
  );
}

function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive font-medium">
      {children}
    </div>
  );
}