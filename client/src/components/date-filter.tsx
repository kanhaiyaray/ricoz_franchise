"use client";

import styles from "./date-filter.module.css";
import type { DateRangeKey } from "@/utils/date-range";

export type { DateRangeKey };

const options: Array<{ value: DateRangeKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

type Props = {
  value: DateRangeKey;
  onChange: (value: DateRangeKey) => void;
  onExport?: () => void;
  exporting?: boolean;
};

export default function DateFilter({ value, onChange, onExport, exporting }: Props) {
  return (
    <div className={styles.bar}>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as DateRangeKey)}
        aria-label="Date range"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {onExport && (
        <button
          className={styles.export}
          type="button"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      )}
    </div>
  );
}
