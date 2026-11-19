"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { AdminService } from "@/services/admin.service";
import type { CreateFranchiseInput } from "@/services/types/admin.types";
import styles from "./admin.module.css";

type FormValues = {
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  commissionRate: string;
  royaltyRate: string;
  monthlyTarget: string;
  maxStaff: string;
  maxTasks: string;
  territory: string;
  adminName: string;
  adminEmail: string;
  sendInvitation: boolean;
};

const steps = ["Basic Info", "Business Setup", "Admin User", "Review"];

const emptyForm: FormValues = {
  name: "",
  ownerName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  commissionRate: "0",
  royaltyRate: "0",
  monthlyTarget: "0",
  maxStaff: "10",
  maxTasks: "50",
  territory: "",
  adminName: "",
  adminEmail: "",
  sendInvitation: true,
};

export default function FranchiseWizard() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    void createFranchise();
  }

  async function createFranchise() {
    setLoading(true);
    setError("");
    const payload: CreateFranchiseInput = {
      name: values.name.trim(),
      ownerName: values.ownerName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pincode: values.pincode.trim(),
      commissionRate: Number(values.commissionRate),
      royaltyRate: Number(values.royaltyRate),
      monthlyTarget: Number(values.monthlyTarget),
      maxStaff: Number(values.maxStaff),
      maxTasks: Number(values.maxTasks),
      territory: values.territory.trim(),
      adminName: values.adminName.trim(),
      adminEmail: values.adminEmail.trim(),
      sendInvitation: values.sendInvitation,
    };

    try {
      const result = await AdminService.createFranchise(payload) as {
        message: string;
        invitationSent: boolean;
        existingAccountLinked: boolean;
        franchise: { _id: string };
      };
      toast.success(result.message);
      if (result.existingAccountLinked) {
        toast.info("The existing account keeps its password. Activate the franchise to grant workspace access.");
      } else if (!result.invitationSent) {
        toast.info("You can send the activation invitation from the franchise Users tab.");
      }
      router.replace(`/admin/franchises/${result.franchise._id}`);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create the franchise.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link href="/admin/franchises" className={styles.wizardBack}>
        <ArrowLeft size={15} /> Back to Franchises
      </Link>
      <div className={styles.pageHeading}>
        <div>
          <h1>Create New Franchise</h1>
          <p>Set up the franchise details, commercial terms, and first administrator.</p>
        </div>
      </div>

      <div className={`${styles.card} ${styles.stepper}`}>
        {steps.map((label, index) => (
          <div
            key={label}
            className={`${styles.step} ${
              index === step ? styles.stepCurrent : index < step ? styles.stepDone : ""
            }`}
          >
            <span className={styles.stepNumber}>
              {index < step ? <Check size={15} /> : index + 1}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <form
        className={`${styles.card} ${styles.formCard}`}
        ref={formRef}
        onSubmit={handleSubmit}
      >
        {step === 0 && (
          <>
            <h2>Basic Information</h2>
            <div className={styles.formGrid}>
              <Field label="Franchise Name">
                <input value={values.name} onChange={(event) => update("name", event.currentTarget.value)} minLength={2} maxLength={120} placeholder="Enter franchise name" required />
              </Field>
              <Field label="Owner Name">
                <input value={values.ownerName} onChange={(event) => update("ownerName", event.currentTarget.value)} minLength={2} maxLength={120} placeholder="Enter owner name" required />
              </Field>
              <Field label="Contact Email">
                <input value={values.email} onChange={(event) => update("email", event.currentTarget.value)} type="email" autoComplete="email" placeholder="owner@example.com" required />
              </Field>
              <Field label="Phone">
                <input value={values.phone} onChange={(event) => update("phone", event.currentTarget.value)} type="tel" minLength={7} maxLength={20} placeholder="Enter phone number" required />
              </Field>
              <Field label="Address" wide>
                <input value={values.address} onChange={(event) => update("address", event.currentTarget.value)} minLength={3} maxLength={300} placeholder="Enter complete address" required />
              </Field>
              <Field label="City">
                <input value={values.city} onChange={(event) => update("city", event.currentTarget.value)} minLength={2} placeholder="City" required />
              </Field>
              <Field label="State">
                <input value={values.state} onChange={(event) => update("state", event.currentTarget.value)} minLength={2} placeholder="State" required />
              </Field>
              <Field label="Pincode">
                <input value={values.pincode} onChange={(event) => update("pincode", event.currentTarget.value)} inputMode="numeric" minLength={4} maxLength={12} placeholder="Postal code" required />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Business Configuration</h2>
            <div className={styles.configGrid}>
              <div className={styles.formGrid}>
                <Field label="Commission Rate (%)">
                  <input value={values.commissionRate} onChange={(event) => update("commissionRate", event.currentTarget.value)} type="number" min="0" max="100" step="0.01" required />
                </Field>
                <Field label="Royalty Fee (%)">
                  <input value={values.royaltyRate} onChange={(event) => update("royaltyRate", event.currentTarget.value)} type="number" min="0" max="100" step="0.01" required />
                </Field>
                <Field label="Monthly Target (₹)">
                  <input value={values.monthlyTarget} onChange={(event) => update("monthlyTarget", event.currentTarget.value)} type="number" min="0" step="1" required />
                </Field>
                <Field label="Maximum Staff">
                  <input value={values.maxStaff} onChange={(event) => update("maxStaff", event.currentTarget.value)} type="number" min="1" step="1" required />
                </Field>
                <Field label="Maximum Tasks">
                  <input value={values.maxTasks} onChange={(event) => update("maxTasks", event.currentTarget.value)} type="number" min="1" step="1" required />
                </Field>
                <Field label="Territory">
                  <input value={values.territory} onChange={(event) => update("territory", event.currentTarget.value)} maxLength={120} placeholder="City, district, or service area" />
                </Field>
              </div>
              <aside className={`${styles.card} ${styles.territoryPreview}`}>
                <h3>Territory Assignment</h3>
                <strong>{values.territory || "Not Assigned"}</strong>
                <p>Protected Area</p>
                <hr />
                <p>This franchise will have exclusive rights to operate in the assigned territory.</p>
              </aside>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Franchise Administrator</h2>
            <div className={styles.inviteGrid}>
              <div className={styles.formGrid}>
                <Field label="Admin Name">
                  <input value={values.adminName} onChange={(event) => update("adminName", event.currentTarget.value)} minLength={2} placeholder="Enter admin name" required />
                </Field>
                <Field label="Admin Email">
                  <input value={values.adminEmail} onChange={(event) => update("adminEmail", event.currentTarget.value)} type="email" autoComplete="email" placeholder="admin@example.com" required />
                </Field>
                <Field label="Role">
                  <input value="Franchise Admin" readOnly />
                </Field>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={values.sendInvitation}
                    onChange={(event) => update("sendInvitation", event.currentTarget.checked)}
                  />
                  <span>Send invitation email</span>
                </label>
                <p className={styles.dataNote}>
                  If this email belongs to an active, unassigned franchise account, it will be linked and keep its existing password. Otherwise a new invited account is created.
                </p>
              </div>
              <aside className={styles.invitationPreview}>
                <h3><Mail size={16} /> Invitation Email Preview</h3>
                <div className={styles.invitationPreviewInner}>
                  <strong>RICOZ</strong>
                  <h4>Welcome to the Ricoz Franchise Network</h4>
                  <p>
                    Hello {values.adminName || "Franchise Admin"}, your franchise workspace will be available after the franchise is activated. New accounts receive a secure setup link; existing accounts keep their current password.
                  </p>
                  <span>New account invitations expire in 72 hours.</span>
                </div>
              </aside>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Review &amp; Confirm</h2>
            <div className={styles.reviewGrid}>
              <ReviewGroup title="Franchise Details">
                <Review label="Franchise Name" value={values.name} />
                <Review label="Owner" value={values.ownerName} />
                <Review label="Email" value={values.email} />
                <Review label="Phone" value={values.phone} />
                <Review label="Location" value={[values.city, values.state, values.pincode].filter(Boolean).join(", ")} />
                <Review label="Territory" value={values.territory || "Not assigned"} />
              </ReviewGroup>
              <ReviewGroup title="Business Settings">
                <Review label="Commission" value={`${values.commissionRate}%`} />
                <Review label="Royalty" value={`${values.royaltyRate}%`} />
                <Review label="Monthly Target" value={`₹${Number(values.monthlyTarget).toLocaleString("en-IN")}`} />
                <Review label="Maximum Staff" value={values.maxStaff} />
                <Review label="Maximum Tasks" value={values.maxTasks} />
                <Review label="Administrator" value={values.adminName} />
                <Review label="Admin Email" value={values.adminEmail} />
                <Review label="Invitation" value={values.sendInvitation ? "Send for new account only" : "Not sent"} />
              </ReviewGroup>
            </div>
          </>
        )}

        {error && <p className={styles.formError} role="alert">{error}</p>}
        <div className={styles.formActions}>
          {step > 0 ? (
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={loading}
              onClick={() => {
                setError("");
                setStep((current) => current - 1);
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : <span />}
          <button className={styles.primaryButton} type="submit" disabled={loading}>
            {step === 3
              ? loading ? "Creating..." : "Create Franchise"
              : <>Continue <ArrowRight size={14} /></>}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ReviewGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.reviewGroup}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.reviewRow}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}
