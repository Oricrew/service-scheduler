import type { LabelHTMLAttributes, ReactNode } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  requiredText?: string;
  optionalText?: string;
};

export function Label({
  children,
  className,
  required,
  optional,
  requiredText = "*",
  optionalText,
  ...props
}: LabelProps) {
  const classes = ["text-sm font-bold text-foreground/90", className]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes} {...props}>
      {children}
      {required ? (
        <span className="ml-1 text-primary">{requiredText}</span>
      ) : null}
      {optional && optionalText ? (
        <span className="ml-1 text-muted">{optionalText}</span>
      ) : null}
    </label>
  );
}
