/** Footer (PRD Section 1): NeuroSync · current year · tagline. */
export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border/60 bg-base">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-content-muted sm:flex-row sm:px-6 lg:px-8">
        <p className="font-semibold text-content-secondary">NeuroSync</p>
        <p>Open Source AI Fine-Tuning Platform</p>
        <p>© {year}</p>
      </div>
    </footer>
  )
}
