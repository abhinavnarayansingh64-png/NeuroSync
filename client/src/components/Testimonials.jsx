import { useEffect, useState } from 'react'

const REVIEWS = [
  { name: 'Aarav S.', role: 'Sent a job · CSE student', text: 'Base price was fair — trained a LoRA for less than a food order.', rating: 5 },
  { name: 'Priya M.', role: 'Runs a receiver', text: 'My GPU sits idle at night anyway — now it earns while I sleep.', rating: 5 },
  { name: 'Rohan D.', role: 'Final year project', text: 'The estimate matched the actual time almost exactly.', rating: 4 },
  { name: 'Sneha K.', role: 'Runs a receiver', text: 'Payout records are clean — I can see exactly what each job paid.', rating: 5 },
]

export function Testimonials() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % REVIEWS.length), 4200)
    return () => clearInterval(id)
  }, [])

  const r = REVIEWS[index]

  return (
    <div className="w-64 rounded-2xl border border-border bg-card p-4 shadow-card animate-fade-in">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-content-muted">From the network</span>
        <div className="flex gap-1">
          {REVIEWS.map((_, i) => (
            <span key={i} className={`h-1 w-1 rounded-full ${i === index ? 'bg-accent' : 'bg-border-strong'}`} />
          ))}
        </div>
      </div>
      <p className="mb-3 min-h-[3.5rem] text-sm leading-snug text-content-secondary">“{r.text}”</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-content-primary">{r.name}</p>
          <p className="text-[10px] text-content-muted">{r.role}</p>
        </div>
        <span className="font-mono text-xs text-status-warning">
          {'★'.repeat(r.rating)}
          <span className="text-border-strong">{'★'.repeat(5 - r.rating)}</span>
        </span>
      </div>
    </div>
  )
}
