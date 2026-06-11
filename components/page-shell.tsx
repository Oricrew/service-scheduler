import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  centered?: boolean;
};

export function PageShell({ children, centered = false }: PageShellProps) {
  return (
    <main
      className={[
        "min-h-screen bg-slate-50 px-5 py-12 text-slate-900 sm:px-8 sm:py-16",
        centered ? "grid place-items-center" : "",
      ].join(" ")}
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </main>
  );
}
