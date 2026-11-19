"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck2,
  Download,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmployeeService } from "@/services/employee.service";
import type {
  EmployeeCategory,
  EmployeeInput,
  EmployeeRecord,
  EmployeeStatus,
} from "@/services/types/employee.types";
import styles from "./employee-management.module.css";

const categories: Array<"All" | EmployeeCategory> = [
  "All",
  "DBA",
  "DevOps",
  "Network",
  "Frontend",
  "Cloud",
  "Backend",
];

const statusLabels: Record<EmployeeStatus, string> = {
  available: "Available",
  on_task: "On task",
  unavailable: "Unavailable",
};

const avatarColors = ["#8c2024", "#ad3033", "#c44a49", "#765153", "#5f4142"];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarColor(name: string) {
  const hash = [...name].reduce((value, character) => value + character.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function formatRating(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function downloadCsv(employees: EmployeeRecord[]) {
  const headers = [
    "Name",
    "Role / Designation",
    "City",
    "Status",
    "Rating",
    "Tasks Done",
    "SLA Met (%)",
    "Skills",
  ];
  const rows = employees.map((employee) => [
    employee.name,
    employee.designation,
    employee.city,
    statusLabels[employee.status],
    employee.rating,
    employee.tasksCompleted,
    employee.slaPercent,
    employee.skills.join(", "),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ricoz-employee-directory.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EmployeeManagement({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [stats, setStats] = useState<{
    availableNow: number;
    onActiveTask: number;
    totalRegistered: number;
    averageRating: number;
  } | null>(null);
  const [searchText, setSearchText] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [category, setCategory] = useState<"All" | EmployeeCategory>("All");
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeRecord | null>(null);
  const [editorEmployee, setEditorEmployee] =
    useState<EmployeeRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let active = true;
    EmployeeService.list(query, category === "All" ? undefined : category)
      .then((result) => {
        if (!active) return;
        setEmployees(result.employees);
        setStats(result.stats);
        setError("");
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load employees.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, query, refreshVersion]);

  function refresh() {
    setLoading(true);
    setRefreshVersion((version) => version + 1);
  }

  function openCreateForm() {
    setEditorEmployee(null);
    setEditorOpen(true);
  }

  function openEditForm(employee: EmployeeRecord) {
    setSelectedEmployee(null);
    setEditorEmployee(employee);
    setEditorOpen(true);
  }

  async function saveEmployee(input: EmployeeInput) {
    if (editorEmployee) {
      await EmployeeService.update(editorEmployee._id, input);
      toast.success("Professional updated.");
    } else {
      await EmployeeService.create(input);
      toast.success("Professional added to the directory.");
    }
    setEditorOpen(false);
    setSelectedEmployee(null);
    refresh();
  }

  async function deleteEmployee(employee: EmployeeRecord) {
    if (!window.confirm(`Delete ${employee.name} from the employee directory?`)) {
      return;
    }
    try {
      await EmployeeService.remove(employee._id);
      toast.success("Professional removed from the directory.");
      setSelectedEmployee(null);
      refresh();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete this professional.",
      );
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeading}>
        <div>
          <h1>Employee Directory</h1>
          <p>Browse, filter and manage all IT professionals</p>
        </div>
        <div className={styles.headingActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => downloadCsv(employees)}
            disabled={employees.length === 0}
          >
            <Download size={16} aria-hidden="true" />
            Export
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={openCreateForm}
          >
            <Plus size={20} aria-hidden="true" />
            Add Professional
          </button>
        </div>
      </div>

      <div className={styles.statsPanel} aria-label="Employee statistics">
        <StatCard
          label="Available Now"
          value={stats?.availableNow}
          icon={<Users size={25} />}
          tone="available"
        />
        <StatCard
          label="On Active Task"
          value={stats?.onActiveTask}
          icon={<CalendarCheck2 size={25} />}
          tone="tasks"
        />
        <StatCard
          label="Total Registered"
          value={stats?.totalRegistered}
          icon={<BarChart3 size={25} />}
          tone="total"
        />
        <StatCard
          label="Avg Rating"
          value={stats ? formatRating(stats.averageRating) : undefined}
          icon={<Star size={25} fill="currentColor" />}
          tone="rating"
          decimal
        />
      </div>

      <div className={styles.filters}>
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <input
            value={searchText}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (value.trim() !== query) setLoading(true);
              setSearchText(value);
            }}
            placeholder="Search by name, skill, or city..."
            aria-label="Search employees by name, skill, or city"
          />
          {searchText && (
            <button
              type="button"
              className={styles.clearSearch}
              onClick={() => setSearchText("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div className={styles.categoryFilters} aria-label="Filter by skill">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={`${styles.categoryButton} ${
                category === item ? styles.categoryActive : ""
              }`}
              aria-pressed={category === item}
              onClick={() => {
                if (category !== item) {
                  setLoading(true);
                  setCategory(item);
                }
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh employees"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className={styles.errorMessage} role="alert">
          <span>{error}</span>
          <button className={styles.secondaryButton} type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.employeeGrid} aria-label="Loading employees">
          {Array.from({ length: 6 }, (_, index) => (
            <div className={styles.loadingCard} key={index} />
          ))}
        </div>
      ) : employees.length ? (
        <div className={styles.employeeGrid}>
          {employees.map((employee) => (
            <EmployeeCard
              key={employee._id}
              employee={employee}
              onClick={() => setSelectedEmployee(employee)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <BriefcaseBusiness size={23} />
          </span>
          <h2>{query || category !== "All" ? "No matches found" : "No professionals yet"}</h2>
          <p>
            {query || category !== "All"
              ? "Try another name, skill, city, or category."
              : "Add a professional to start building your employee directory."}
          </p>
          {query || category !== "All" ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                if (query || category !== "All") setLoading(true);
                setSearchText("");
                setCategory("All");
              }}
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={openCreateForm}
            >
              <Plus size={17} />
              Add Professional
            </button>
          )}
        </div>
      )}

      {selectedEmployee && (
        <EmployeeProfileDialog
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => openEditForm(selectedEmployee)}
          onDelete={() => void deleteEmployee(selectedEmployee)}
        />
      )}

      {editorOpen && (
        <EmployeeFormDialog
          key={editorEmployee?._id ?? "new"}
          employee={editorEmployee}
          onClose={() => setEditorOpen(false)}
          onSave={saveEmployee}
        />
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  decimal = false,
}: {
  label: string;
  value?: number | string;
  icon: React.ReactNode;
  tone: "available" | "tasks" | "total" | "rating";
  decimal?: boolean;
}) {
  return (
    <div className={`${styles.statCard} ${styles[`stat${tone}`]}`}>
      <span className={styles.statIcon}>{icon}</span>
      <strong className={styles.statValue}>
        {value === undefined ? "—" : decimal ? value : value}
      </strong>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${formatRating(rating)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={14}
          fill={index < Math.round(rating) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function EmployeeCard({
  employee,
  onClick,
}: {
  employee: EmployeeRecord;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.employeeCard}
      onClick={onClick}
      aria-label={`View ${employee.name}, ${employee.designation}`}
    >
      <div className={styles.cardHeader}>
        <span
          className={styles.employeeAvatar}
          style={{ backgroundColor: avatarColor(employee.name) }}
          aria-hidden="true"
        >
          {initials(employee.name)}
        </span>
        <span className={styles.employeeIntro}>
          <strong>{employee.name}</strong>
          <small>{employee.designation}</small>
          <span className={styles.ratingLine}>
            <RatingStars rating={employee.rating} />
            <span>{formatRating(employee.rating)} · {employee.tasksCompleted} tasks</span>
          </span>
        </span>
        <span className={`${styles.statusBadge} ${styles[`status${employee.status}`]}`}>
          {statusLabels[employee.status]}
        </span>
      </div>
      <div className={styles.cardMetrics}>
        <span>
          <strong>{employee.tasksCompleted}</strong>
          <small>Tasks</small>
        </span>
        <span>
          <strong>{employee.slaPercent}%</strong>
          <small>SLA</small>
        </span>
        <span>
          <strong>{employee.city || "—"}</strong>
          <small>City</small>
        </span>
      </div>
    </button>
  );
}

function EmployeeProfileDialog({
  employee,
  onClose,
  onEdit,
  onDelete,
}: {
  employee: EmployeeRecord;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className={styles.profileDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-profile-title"
      >
        <div className={styles.dialogHeading}>
          <h2 id="employee-profile-title">Professional Details</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close professional details"
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.profileSummary}>
          <span
            className={styles.profileAvatar}
            style={{ backgroundColor: avatarColor(employee.name) }}
            aria-hidden="true"
          >
            {initials(employee.name)}
          </span>
          <div className={styles.profileIdentity}>
            <strong>{employee.name}</strong>
            <span>{employee.designation}</span>
            <div className={styles.profileMeta}>
              <span className={`${styles.statusBadge} ${styles[`status${employee.status}`]}`}>
                {statusLabels[employee.status]}
              </span>
              {employee.city && (
                <span className={styles.location}>
                  <MapPin size={12} />
                  {employee.city}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.profileMetrics}>
          <div>
            <strong>{employee.tasksCompleted}</strong>
            <span>Tasks Done</span>
          </div>
          <div>
            <strong>{employee.slaPercent}%</strong>
            <span>SLA Met</span>
          </div>
          <div>
            <strong>{formatRating(employee.rating)} ★</strong>
            <span>Rating</span>
          </div>
        </div>
        <div className={styles.skillsSection}>
          <h3>Skills</h3>
          <div className={styles.skillTags}>
            {employee.skills.length ? (
              employee.skills.map((skill) => <span key={skill}>{skill}</span>)
            ) : (
              <span className={styles.noSkills}>No skills added</span>
            )}
          </div>
        </div>
        <div className={styles.dialogActions}>
          <button
            className={styles.deleteButton}
            type="button"
            onClick={onDelete}
          >
            <Trash2 size={15} />
            Delete
          </button>
          <button className={styles.primaryButton} type="button" onClick={onEdit}>
            <Pencil size={15} />
            Edit
          </button>
        </div>
      </section>
    </div>
  );
}

type EmployeeFormState = {
  name: string;
  designation: string;
  city: string;
  status: EmployeeStatus;
  skills: string;
  rating: string;
};

function EmployeeFormDialog({
  employee,
  onClose,
  onSave,
}: {
  employee: EmployeeRecord | null;
  onClose: () => void;
  onSave: (input: EmployeeInput) => Promise<void>;
}) {
  const [form, setForm] = useState<EmployeeFormState>({
    name: employee?.name ?? "",
    designation: employee?.designation ?? "",
    city: employee?.city ?? "",
    status: employee?.status ?? "available",
    skills: employee?.skills.join(", ") ?? "",
    rating: String(employee?.rating ?? 4.5),
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const skills = form.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
    const input: EmployeeInput = {
      name: form.name.trim(),
      designation: form.designation.trim(),
      city: form.city.trim(),
      status: form.status,
      skills,
      rating: Number(form.rating),
    };
    if (input.name.length < 2 || input.designation.length < 2) {
      toast.error("Enter a name and role with at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      await onSave(input);
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save this professional.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateField(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const field = event.currentTarget.name as keyof EmployeeFormState;
    setForm((current) => ({
      ...current,
      [field]: event.currentTarget.value,
    }));
  }

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) onClose();
      }}
    >
      <section
        className={styles.formDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-title"
      >
        <div className={styles.dialogHeading}>
          <h2 id="employee-form-title">
            {employee ? "Edit Professional" : "Add New Professional"}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close form"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Full Name *</span>
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Enter Full Name"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Role / Designation *</span>
              <input
                name="designation"
                value={form.designation}
                onChange={updateField}
                placeholder="Senior DBA"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label className={styles.field}>
              <span>City</span>
              <input
                name="city"
                value={form.city}
                onChange={updateField}
                placeholder="Enter City"
                maxLength={100}
              />
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select name="status" value={form.status} onChange={updateField}>
                <option value="available">Available</option>
                <option value="on_task">On task</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Skills (comma-separated)</span>
              <input
                name="skills"
                value={form.skills}
                onChange={updateField}
                placeholder="PostgreSQL, DBA, Oracle"
                maxLength={500}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Rating (1–5)</span>
              <input
                name="rating"
                type="number"
                value={form.rating}
                onChange={updateField}
                min={1}
                max={5}
                step={0.1}
                required
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : employee
                  ? "Save Changes"
                  : "Add Professional"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
