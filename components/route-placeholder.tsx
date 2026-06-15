type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
}: RoutePlaceholderProps) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        {description}
      </p>
    </section>
  );
}
