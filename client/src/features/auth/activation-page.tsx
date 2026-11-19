"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "@/services/auth.service";
import styles from "./auth-pages.module.css";

export default function ActivationPage({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This invitation link is incomplete.");
      return;
    }

    setLoading(true);
    try {
      const result = await AuthService.acceptInvitation({
        token,
        password,
        confirmPassword,
      });
      toast.success(result.message ?? "Account activated.");
      router.replace("/login?portal=franchise");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to activate this account.";
      setError(message);
      setExpired(message.toLowerCase().includes("expired"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/" className={styles.brand}>RICOZ</Link>
        <h1 className={styles.heading}>Activate your franchise account</h1>
        <p className={styles.description}>
          Choose a password to finish setting up your Ricoz Franchise Portal access.
        </p>
        {expired ? (
          <>
            <p className={styles.error} role="alert">{error}</p>
            <p className={styles.footer}>
              Contact the administrator who invited you to request a new activation email.
            </p>
          </>
        ) : (
          <form
            className={styles.form}
            onSubmit={handleSubmit}
            onChange={() => error && setError("")}
          >
            <div className={styles.field}>
              <label htmlFor="activation-password">New Password</label>
              <input
                id="activation-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Create a password"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="activation-confirm">Confirm Password</label>
              <input
                id="activation-confirm"
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
              {loading ? "Activating..." : "Activate Account"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
