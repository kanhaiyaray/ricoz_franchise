"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "@/services/auth.service";
import type { UserPortal } from "@/services/types/auth.types";
import { clearAuth, setSession } from "@/redux/slice/auth.slice";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import styles from "./auth-pages.module.css";

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

type LoginPageProps = {
  initialPortal?: UserPortal;
  initialEmail?: string;
  redirectTo?: string;
};

export function LoginPage({
  initialPortal = "franchise",
  initialEmail = "",
  redirectTo,
}: LoginPageProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [portal, setPortal] = useState<UserPortal>(initialPortal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);

    try {
      const session = await AuthService.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        portal,
      });

      dispatch(setSession({
        accessToken: session.access_token,
        user: session.user,
      }));
      toast.success("Logged in successfully.");

      const portalRoot = portal === "admin" ? "/admin" : "/dashboard";
      const destination =
        redirectTo &&
        (redirectTo === portalRoot || redirectTo.startsWith(`${portalRoot}/`))
          ? redirectTo
          : portalRoot;
      router.replace(destination);
    } catch (caughtError) {
      setError(messageFrom(caughtError, "Unable to log in. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Ricoz home">RICOZ</Link>
        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.description}>
          Choose your portal and sign in to continue to your Ricoz workspace.
        </p>
        <div className={styles.portals} role="group" aria-label="Choose login portal">
          <button
            className={styles.portalButton}
            type="button"
            aria-pressed={portal === "franchise"}
            onClick={() => setPortal("franchise")}
          >
            Franchise Portal
          </button>
          <button
            className={styles.portalButton}
            type="button"
            aria-pressed={portal === "admin"}
            onClick={() => setPortal("admin")}
          >
            Admin Portal
          </button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="portal-email">Email Address</label>
            <input
              id="portal-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={initialEmail}
              placeholder="Enter your email address"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="portal-password">Password</label>
            <input
              id="portal-password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              placeholder="Enter your password"
              required
            />
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Signing in..." : `Sign in to ${portal === "admin" ? "Admin" : "Franchise"} Portal`}
          </button>
        </form>
        {portal === "franchise" ? (
          <p className={styles.footer}>
            New to Ricoz? <Link href="/signup">Create a franchise account</Link>
          </p>
        ) : (
          <p className={styles.note}>
            Admin accounts are provisioned internally. Public admin registration is disabled.
          </p>
        )}
      </section>
    </main>
  );
}

export function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode() {
    setError("");
    if (!email.trim()) {
      setError("Enter your email address before requesting a verification code.");
      return;
    }

    setLoading(true);
    try {
      await AuthService.sendOtp(email);
      setOtpSent(true);
      toast.success("Verification code sent to your email.");
    } catch (caughtError) {
      setError(messageFrom(caughtError, "Unable to send a verification code."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!otpSent) {
      setError("Request a verification code before creating your account.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.signup({
        name: String(form.get("name") ?? ""),
        email,
        otp: String(form.get("otp") ?? ""),
        password,
        confirmPassword,
      });
      if (result?.success !== true) {
        throw new Error("The registration service did not confirm account creation.");
      }
      toast.success("Franchise account created. You can now sign in.");
      router.replace(`/login?portal=franchise&email=${encodeURIComponent(email)}`);
    } catch (caughtError) {
      setError(messageFrom(caughtError, "Unable to create your account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand} aria-label="Ricoz home">RICOZ</Link>
        <h1 className={styles.heading}>Create your franchise account</h1>
        <p className={styles.description}>
          Register to access the Ricoz Franchise Portal. Admin accounts are created internally.
        </p>
        <form
          className={styles.form}
          onSubmit={handleSubmit}
          onChange={() => {
            if (error) setError("");
          }}
        >
          <div className={styles.field}>
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              name="name"
              autoComplete="name"
              minLength={3}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-email">Email Address</label>
            <div className={styles.emailAction}>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => {
                  setEmail(event.currentTarget.value);
                  setOtpSent(false);
                }}
                required
              />
              <button type="button" onClick={handleSendCode} disabled={loading}>
                {otpSent ? "Resend code" : "Send code"}
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-otp">Email Verification Code</label>
            <input
              id="signup-otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="Enter the 6-digit code"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Create a password"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Confirm your password"
              required
            />
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create franchise account"}
          </button>
        </form>
        <p className={styles.footer}>
          Already have an account? <Link href="/login?portal=franchise">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

type PortalGuardProps = {
  role: UserPortal;
  children: React.ReactNode;
};

export function PortalGuard({ role, children }: PortalGuardProps) {
  const router = useRouter();
  const { status, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (status === "unauthenticated") {
      const portalRoot = role === "admin" ? "/admin" : "/dashboard";
      router.replace(
        `/login?portal=${role}&redirect=${encodeURIComponent(portalRoot)}`,
      );
    } else if (status === "authenticated" && user?.user_role !== role) {
      router.replace(user?.user_role === "admin" ? "/admin" : "/dashboard");
    }
  }, [role, router, status, user?.user_role]);

  if (status !== "authenticated" || user?.user_role !== role) {
    return (
      <main className={styles.portalPage} aria-live="polite">
        <div className={styles.portalCard}>
          <h1>Verifying portal access</h1>
          <p>Please wait while your Ricoz session is checked.</p>
        </div>
      </main>
    );
  }

  return children;
}

export function PortalHome({ role }: { role: UserPortal }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await AuthService.logout();
    } catch (caughtError) {
      toast.error(messageFrom(caughtError, "Unable to log out. Please try again."));
    } finally {
      // BUG FIX #13: clear local session even if the API call fails.
      dispatch(clearAuth());
      router.replace("/login");
      setLoggingOut(false);
    }
  }

  return (
    <PortalGuard role={role}>
      <main className={styles.portalPage}>
        <section className={styles.portalCard}>
          <Link href="/" className={styles.brand}>RICOZ</Link>
          <h1>{role === "admin" ? "Admin Portal" : "Franchise Portal"}</h1>
          <p>
            Signed in as <strong>{user?.user_name}</strong> ({user?.user_email}).
          </p>
          <p>Your role-verified Ricoz workspace is ready.</p>
          <div className={styles.portalActions}>
            <Link href="/">Back to website</Link>
            <button type="button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </section>
      </main>
    </PortalGuard>
  );
}
