"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthService } from "@/services/auth.service";
import type { LoginInput, RegisterInput, UserPortal } from "@/services/types/auth.types";
import { setSession } from "@/redux/slice/auth.slice";
import { useAppDispatch } from "@/redux/hooks";
import { toast } from "sonner";
import styles from "./contact-login-modals.module.css";

type ModalProps = {
  onClose: () => void;
};

type DialogShellProps = ModalProps & {
  title: ReactNode;
  subtitle?: string;
  variant: "contact" | "login";
  children: ReactNode;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const occupations = [
  "Business Owner",
  "Working Professional",
  "Entrepreneur",
  "Other",
];

function DialogShell({ onClose, title, subtitle, variant, children }: DialogShellProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${variant === "contact" ? styles.contactDialog : styles.loginDialog}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        aria-labelledby={typeof title === "string" ? undefined : "landing-dialog-title"}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id="landing-dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close dialog">
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function ContactModal({ onClose }: ModalProps) {
  const [notice, setNotice] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(true);
  }

  return (
    <DialogShell
      onClose={onClose}
      variant="contact"
      title={<>Let&apos;s Talk About Your <span>Business Goals</span></>}
      subtitle="Tell us a little about yourself and our franchise team will help you explore the right opportunity."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="contact-name">Full Name <b>*</b></label>
          <input id="contact-name" name="fullName" type="text" autoComplete="name" placeholder="Full name" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-mobile">Mobile Number <b>*</b></label>
          <input
            id="contact-mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Mobile number"
            pattern="[0-9]{10,15}"
            title="Enter a valid phone number"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-email">Email Address <b>*</b></label>
          <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="Enter your email address" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-occupation">Occupation <b>*</b></label>
          <select id="contact-occupation" name="occupation" defaultValue="" required>
            <option value="" disabled>Select</option>
            {occupations.map((occupation) => <option key={occupation}>{occupation}</option>)}
          </select>
        </div>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="contact-city">City <b>*</b></label>
            <input id="contact-city" name="city" autoComplete="address-level2" placeholder="Enter your city" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="contact-state">State <b>*</b></label>
            <input id="contact-state" name="state" autoComplete="address-level1" placeholder="Enter your state" required />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="contact-message">Additional Message</label>
          <textarea id="contact-message" name="message" placeholder="Any special query" rows={3} />
        </div>
        {notice && (
          <p className={styles.notice} role="status">
            Contact form submission is not connected yet. Your information has not been sent.
          </p>
        )}
        <button className={styles.submitButton} type="submit">Speak With Our Team</button>
      </form>
    </DialogShell>
  );
}

type LoginResponse = {
  access_token: string;
  user: {
    user_id: string;
    user_name: string;
    user_email: string;
    user_dp?: string;
    user_about?: string;
    user_role: UserPortal;
  };
};

function isLoginResponse(response: unknown): response is LoginResponse {
  if (typeof response !== "object" || response === null) return false;
  const candidate = response as Partial<LoginResponse>;
  return (
    typeof candidate.access_token === "string" &&
    typeof candidate.user?.user_id === "string" &&
    typeof candidate.user.user_name === "string" &&
    typeof candidate.user.user_email === "string" &&
    (candidate.user.user_role === "admin" || candidate.user.user_role === "franchise")
  );
}

type LoginModalProps = ModalProps & {
  initialEmail: string;
  initialPortal?: UserPortal;
};

export function LoginModal({
  onClose,
  initialEmail,
  initialPortal = "franchise",
}: LoginModalProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [portal, setPortal] = useState<UserPortal>(initialPortal);
  const [email, setEmail] = useState(initialEmail);
  const [rememberMe, setRememberMe] = useState(Boolean(initialEmail));
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const credentials: LoginInput = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      portal,
    };

    try {
      const response = await AuthService.login(credentials);
      if (!isLoginResponse(response)) {
        throw new Error("The login service returned an incomplete response.");
      }

      dispatch(setSession({
        accessToken: response.access_token,
        user: {
          user_id: response.user.user_id,
          user_name: response.user.user_name,
          user_email: response.user.user_email,
          user_dp: response.user.user_dp ?? "",
          user_about: response.user.user_about ?? "",
          user_role: response.user.user_role,
        },
      }));

      try {
        if (rememberMe) {
          window.localStorage.setItem("ricozRememberedEmail", credentials.email);
        } else {
          window.localStorage.removeItem("ricozRememberedEmail");
        }
      } catch {
        if (rememberMe) {
          toast.warning("Login succeeded, but this browser could not remember your email address.");
        }
      }

      toast.success("Logged in successfully.");
      onClose();
      router.push(response.user.user_role === "admin" ? "/admin" : "/dashboard");
    } catch (caughtError) {
      const message = getErrorMessage(caughtError, "Unable to log in. Please try again.");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
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
      setError(getErrorMessage(caughtError, "Unable to send a verification code."));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
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

    const registration: RegisterInput = {
      name: String(form.get("name") ?? ""),
      email,
      otp: String(form.get("otp") ?? ""),
      password,
      confirmPassword,
    };

    setLoading(true);
    try {
      const result = await AuthService.signup(registration);
      if (result?.success !== true) {
        throw new Error("The registration service did not confirm account creation.");
      }
      setMode("login");
      setOtpSent(false);
      toast.success("Account created. Log in with your new credentials.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Unable to create your account."));
    } finally {
      setLoading(false);
    }
  }

  function enterRegisterMode() {
    setError("");
    setOtpSent(false);
    setMode("register");
  }

  function returnToLogin() {
    setError("");
    setMode("login");
  }

  return (
    <DialogShell
      onClose={onClose}
      variant="login"
      title={mode === "login"
        ? <>Login to the <span>Ricoz {portal === "admin" ? "Admin" : "Franchise"} Portal</span></>
        : <>Create Your <span>Ricoz Franchise Account</span></>}
    >
      {mode === "login" ? (
        <form
          className={styles.form}
          onSubmit={handleLogin}
          onChange={() => {
            if (error) setError("");
          }}
        >
          <div className={styles.field}>
            <label htmlFor="login-portal">Portal</label>
            <select
              id="login-portal"
              value={portal}
              onChange={(event) => setPortal(event.currentTarget.value as UserPortal)}
            >
              <option value="franchise">Franchise Portal</option>
              <option value="admin">Admin Portal</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={`Enter your ${portal} account email address`}
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
          </div>
          <label className={styles.rememberMe}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.currentTarget.checked)}
            />
            <span>Remember Me</span>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submitButton} type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <p className={styles.registerPrompt}>
            Don&apos;t have an account? <button type="button" onClick={enterRegisterMode}>Register here</button>
          </p>
        </form>
      ) : (
        <form
          className={`${styles.form} ${styles.registerForm}`}
          onSubmit={handleRegister}
          onChange={() => {
            if (error) setError("");
          }}
        >
          <div className={styles.field}>
            <label htmlFor="register-name">Full Name</label>
            <input id="register-name" name="name" autoComplete="name" placeholder="Enter your full name" minLength={3} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-email">Email Address</label>
            <div className={styles.emailWithAction}>
              <input
                id="register-email"
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
              <button type="button" onClick={handleSendOtp} disabled={loading}>
                {otpSent ? "Resend Code" : "Send Code"}
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="register-otp">Email Verification Code</label>
            <input id="register-otp" name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter 6-digit code" pattern="[0-9]{6}" maxLength={6} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-password">Password</label>
            <input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" minLength={8} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <input id="register-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm your password" minLength={8} required />
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submitButton} type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
          <p className={styles.registerPrompt}>
            Already have an account? <button type="button" onClick={returnToLogin}>Log in</button>
          </p>
          <p className={styles.registerPrompt}>
            Prefer a dedicated page? <Link href="/signup">Sign up here</Link>
          </p>
        </form>
      )}
    </DialogShell>
  );
}
