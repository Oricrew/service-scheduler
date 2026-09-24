import type { InputHTMLAttributes } from "react";

const base =
  "rounded-2xl border border-border px-4 py-3 text-base outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-ring-focus";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  const classes = [base, className].filter(Boolean).join(" ");

  return <input className={classes} {...props} />;
}
