import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center transition disabled:cursor-not-allowed";

const variants = {
  primary:
    "rounded-button font-black bg-foreground text-surface-elevated shadow-sm hover:bg-foreground/85 disabled:bg-muted disabled:hover:bg-muted",
  secondary:
    "rounded-button font-bold border border-border text-foreground hover:border-primary hover:bg-primary-light",
  ghost:
    "rounded-button font-bold text-muted hover:bg-primary-light hover:text-primary",
} as const;

const sizes = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-6 py-3 text-sm",
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
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [base, variants[variant], sizes[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
