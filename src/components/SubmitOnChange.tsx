"use client";

import { useRef } from "react";

// A <select> that submits its parent form automatically when changed.
export default function SubmitOnChange({
  name,
  value,
  options,
  className,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  return (
    <select
      ref={ref}
      name={name}
      defaultValue={value}
      className={className || "input py-1 text-xs"}
      onChange={() => ref.current?.form?.requestSubmit()}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
