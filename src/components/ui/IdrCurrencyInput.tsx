"use client";

import * as React from "react";

function normalizeRawDigits(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function parseToRawDigits(value: string): string {
  const s = String(value ?? "");
  // If the user pasted a formatted IDR string like "Rp 2.000,00",
  // treat everything before the comma as the whole-IDR part to avoid x100 scaling.
  const beforeComma = s.includes(",") ? s.split(",")[0] ?? "" : s;
  return normalizeRawDigits(beforeComma);
}

function formatIdrFromRaw(rawDigits: string): string {
  const raw = normalizeRawDigits(rawDigits);
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";

  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

  const withSpace = formatted.replace("Rp", "Rp ");
  return withSpace.replace(/\s+/g, " ");
}

export type IdrCurrencyInputProps = {
  id: string;
  label: string;
  raw: string;
  onRawChange: (rawDigits: string) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  hint?: string;
};

export default function IdrCurrencyInput({
  id,
  label,
  raw,
  onRawChange,
  name,
  placeholder,
  required,
  disabled,
  className,
  labelClassName,
  inputClassName,
  hint,
}: IdrCurrencyInputProps) {
  const display = formatIdrFromRaw(raw);

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={labelClassName ?? "text-sm font-semibold text-slate-500"}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={display}
        onChange={(e) => {
          const inputEvent = e.nativeEvent as InputEvent | undefined;
          let nextRaw = raw ?? "";

          if (
            inputEvent?.inputType === "insertText" &&
            /\d/.test(inputEvent.data ?? "")
          ) {
            nextRaw = `${nextRaw}${inputEvent.data ?? ""}`;
          } else if (inputEvent?.inputType === "deleteContentBackward") {
            nextRaw = String(nextRaw).slice(0, -1);
          } else {
            nextRaw = parseToRawDigits(e.target.value);
          }

          onRawChange(normalizeRawDigits(nextRaw));
        }}
        inputMode="decimal"
        required={required}
        disabled={disabled}
        className={
          inputClassName ??
          "h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
        }
        placeholder={placeholder}
      />
      {hint ? <div className="text-[11px] text-neutral-500">{hint}</div> : null}
    </div>
  );
}
