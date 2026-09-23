import type { HTMLAttributes, ReactNode } from "react";

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

type CardHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export function CardHeader({
  eyebrow,
  title,
  description,
  children,
}: CardHeaderProps) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={[
          "text-4xl font-black leading-none tracking-tight",
          eyebrow ? "mt-4" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-4 text-lg leading-8 text-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
