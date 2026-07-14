export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-lg font-semibold text-white/90">
        {title}
      </h2>
      {children}
    </section>
  );
}
