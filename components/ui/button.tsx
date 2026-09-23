import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center font-black transition disabled:cursor-not-allowed";

const variants = {
  primary:
    "rounded-button bg-foreground px-6 py-3 text-sm text-surface-elevated shadow-sm hover:bg-foreground/85 disabled:bg-muted disabled:hover:bg-muted",
  secondary:
    "rounded-button border border-border px-5 py-2 text-sm font-bold text-foreground hover:border-primary hover:bg-primary-light",
  ghost:
    "rounded-button px-4 py-2 text-sm font-bold text-muted hover:bg-primary-light hover:text-primary",
} as const;

const sizes = {
  sm: "px-4 py-1.5 text-xs",
  md: "",
  lg: "px-8 py-4 text-base",
} as const;

type ButtonVariant = keyof typeof variants;
type ButtonSize = keyof typeof sizes;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [base, variants[variant], sizes[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
