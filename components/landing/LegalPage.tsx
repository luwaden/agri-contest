import { PageShell } from "./PageShell";

export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: Array<[string, string[]]> }) {
  return (
    <PageShell>
      <div className="container-page max-w-3xl py-14 sm:py-20">
        <p className="eyebrow">Summary notice</p>
        <h1 className="mt-3 font-display text-display-xl text-primary">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated {updated}</p>
        <p className="mt-6 text-lg text-ink-soft">{intro}</p>
        {sections.map(([h, ps]) => (
          <section key={h} className="mt-10"><h2 className="font-display text-2xl text-primary">{h}</h2>{ps.map((p) => <p key={p} className="mt-3 leading-relaxed text-ink-soft">{p}</p>)}</section>
        ))}
      </div>
    </PageShell>
  );
}
