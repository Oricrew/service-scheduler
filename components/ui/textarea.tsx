import type { TextareaHTMLAttributes } from "react";

const base =
  "min-h-32 rounded-2xl border border-border px-4 py-3 text-base outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-ring-focus";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  const classes = [base, className].filter(Boolean).join(" ");

  return <textarea className={classes} {...props} />;
}
