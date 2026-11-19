"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { FranchiseApplicationService } from "@/services/application.service";
import styles from "./application-modal.module.css";

type ApplicationModalProps = {
  onClose: () => void;
};

type UploadFieldProps = {
  id: string;
  label: string;
  description: string;
  maxBytes: number;
};

const occupations = [
  "Business Owner",
  "Working Professional",
  "Entrepreneur",
  "Retired",
  "Other",
];

const investmentRanges = [
  "Below ₹5 Lakhs",
  "₹5-10 Lakhs",
  "₹10-25 Lakhs",
  "₹25-50 Lakhs",
  "Above ₹50 Lakhs",
];

export default function ApplicationModal({ onClose }: ApplicationModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const profileFormRef = useRef<HTMLFormElement>(null);
  const verificationFormRef = useRef<HTMLFormElement>(null);

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
      )).filter((element) => !element.closest("[hidden]"));
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

  useEffect(() => {
    const activeForm = dialogRef.current?.querySelector<HTMLFormElement>(`form[data-step="${step}"]`);
    activeForm?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, [step]);

  function continueToVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(2);
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileFormRef.current || !verificationFormRef.current) {
      toast.error("Unable to read the application form. Please try again.");
      return;
    }

    const formData = new FormData();
    for (const form of [profileFormRef.current, verificationFormRef.current]) {
      new FormData(form).forEach((value, key) => formData.append(key, value));
    }
    setSubmitting(true);
    try {
      const result = await FranchiseApplicationService.submit(formData);
      setSubmittedId(result.applicationId);
      toast.success("Your application has been submitted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to submit your application.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-title"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id="application-title">
              {step === 1 ? (
                <>Apply To Become A <span>Franchise Partner</span></>
              ) : (
                <>Identity &amp; Financial <span>Verification</span></>
              )}
            </h2>
            <p>
              {step === 1
                ? "Complete the application below and our team will review your profile and reach out with the next steps."
                : "To maintain the quality of our franchise network, all applicants are required to complete identity and financial verification."}
            </p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close application">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.stepper} aria-label={`Step ${step} of 2`}>
          <span className={`${styles.step} ${styles.stepActive}`}>1</span>
          <span className={`${styles.stepLine} ${step === 2 ? styles.stepLineActive : ""}`} />
          <span className={`${styles.step} ${step === 2 ? styles.stepActive : ""}`}>2</span>
        </div>

        {!submittedId ? (
        <>
        <form ref={profileFormRef} className={styles.form} data-step="1" hidden={step !== 1} onSubmit={continueToVerification}>
            <div className={styles.field}>
              <label htmlFor="applicant-name">Full Name <b>*</b></label>
              <input id="applicant-name" name="fullName" type="text" autoComplete="name" placeholder="Full name" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="applicant-mobile">Mobile Number <b>*</b></label>
              <input
                id="applicant-mobile"
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
              <label htmlFor="applicant-email">Email Address <b>*</b></label>
              <input id="applicant-email" name="email" type="email" autoComplete="email" placeholder="Enter your email address" required />
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="applicant-city">City <b>*</b></label>
                <input id="applicant-city" name="city" autoComplete="address-level2" placeholder="City" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="applicant-state">State <b>*</b></label>
                <input id="applicant-state" name="state" autoComplete="address-level1" placeholder="State" required />
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="applicant-occupation">Occupation <b>*</b></label>
                <select id="applicant-occupation" name="occupation" defaultValue="" required>
                  <option value="" disabled>Select</option>
                  {occupations.map((occupation) => <option key={occupation}>{occupation}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="applicant-investment">Investment <b>*</b></label>
                <select id="applicant-investment" name="investment" defaultValue="" required>
                  <option value="" disabled>Select</option>
                  {investmentRanges.map((range) => <option key={range}>{range}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="applicant-reason">Why Do You Want To Join Ricoz?</label>
              <textarea id="applicant-reason" name="reason" placeholder="Tell us why do you want to join us" rows={3} />
            </div>
            <label className={styles.consent}>
              <input name="termsAccepted" type="checkbox" required />
              <span>I agree to the <a href="#terms">Terms &amp; Conditions</a> and <a href="#privacy">Privacy Policy</a>.</span>
            </label>
            <button className={styles.submitButton} type="submit">Continue To Verification</button>
        </form>
        <form ref={verificationFormRef} className={styles.form} data-step="2" hidden={step !== 2} onSubmit={submitApplication}>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="applicant-aadhaar">Aadhaar Number <b>*</b></label>
                <input
                  id="applicant-aadhaar"
                  name="aadhaarNumber"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="XXXX XXXX XXXX"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  title="Enter the 12-digit Aadhaar number without spaces"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="applicant-pan">PAN Number <b>*</b></label>
                <input
                  id="applicant-pan"
                  name="panNumber"
                  autoComplete="off"
                  placeholder="ABCDE1234F"
                  pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
                  maxLength={10}
                  title="Enter a valid 10-character PAN number"
                  required
                />
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <UploadField id="aadhaar-document" label="Aadhaar Card" description="PDF/JPG/PNG, max 10MB" maxBytes={10 * 1024 * 1024} />
              <UploadField id="pan-document" label="PAN Card" description="PDF/JPG/PNG, max 10MB" maxBytes={10 * 1024 * 1024} />
            </div>
            <div className={styles.field}>
              <label htmlFor="account-holder">Account Holder Name <b>*</b></label>
              <input id="account-holder" name="accountHolder" autoComplete="name" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="bank-name">Bank Name <b>*</b></label>
              <input id="bank-name" name="bankName" placeholder="Bank name" autoComplete="off" required />
            </div>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="account-number">Account Number <b>*</b></label>
                <input id="account-number" name="accountNumber" inputMode="numeric" placeholder="Account number" autoComplete="off" pattern="[0-9]{6,18}" title="Enter 6 to 18 digits" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="ifsc-code">IFSC Code <b>*</b></label>
                <input id="ifsc-code" name="ifscCode" placeholder="IFSC code" autoComplete="off" pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} title="Enter a valid 11-character IFSC code" required />
              </div>
            </div>
            <UploadField
              id="bank-statement"
              label="Last 6 Months Bank Statement"
              description="PDF preferred, max 20MB"
              maxBytes={20 * 1024 * 1024}
            />
            <label className={styles.consent}>
              <input name="verificationConsent" type="checkbox" required />
              <span>I consent to Ricoz securely processing these identity and financial documents for application verification.</span>
            </label>
            <p className={styles.privacyNotice}>
              Identity, financial, and document information is encrypted before storage and is available only to authorized Ricoz administrators.
            </p>
            <div className={styles.formActions}>
              <button className={styles.backButton} type="button" onClick={() => setStep(1)}>Back</button>
              <button className={styles.submitButton} type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
        </form>
        </>
        ) : (
          <div className={styles.submissionSuccess} role="status">
            <strong>Application submitted successfully</strong>
            <p>Our franchise team will review your details and contact you with the next steps.</p>
            <small>Application reference: {submittedId}</small>
            <button className={styles.submitButton} type="button" onClick={onClose}>Done</button>
          </div>
        )}
      </section>
    </div>
  );
}

function UploadField({ id, label, description, maxBytes }: UploadFieldProps) {
  const [fileName, setFileName] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      setFileName("");
      return;
    }

    if (file.size > maxBytes) {
      input.value = "";
      setFileName("");
      toast.error(`${label} file exceeds the maximum size of ${Math.round(maxBytes / (1024 * 1024))}MB.`);
      return;
    }

    setFileName(file.name);
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label} <b>*</b></label>
      <label className={styles.uploadBox} htmlFor={id}>
        <Upload aria-hidden="true" />
        <strong>Browse File</strong>
        <small>{fileName || description}</small>
        <input
          className={styles.fileInput}
          id={id}
          name={id}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleFileChange}
          required
        />
      </label>
    </div>
  );
}
