import { createElement, type HTMLAttributes, type ReactNode } from "react";

const base =
  "rounded-card bg-surface-elevated p-5 shadow-sm ring-1 ring-border sm:p-8";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...props }: CardProps) {
  const classes = [base, className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type CardHeaderProps = {
  eyebrow?: string;
  title: string;
  titleAs?: HeadingLevel;
  description?: string;
  children?: ReactNode;
};

export function CardHeader({
  eyebrow,
  title,
  titleAs = "h2",
  description,
  children,
}: CardHeaderProps) {
  const titleClassName = [
    "text-4xl font-black leading-none tracking-tight",
    eyebrow ? "mt-4" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {eyebrow ? (
        <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      {createElement(titleAs, { className: titleClassName }, title)}
      {description ? (
        <p className="mt-4 text-lg leading-8 text-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
