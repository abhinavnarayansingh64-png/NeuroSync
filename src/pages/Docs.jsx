/**
 * Docs — a real getting-started guide covering the sender flow, the
 * receiver flow, and how pricing/payments work. Linked from the landing
 * page navbar (previously a dead #docs anchor).
 */

import { Link } from 'react-router-dom'
import { MarketingPage } from '../components/MarketingPage'
import { Icon } from '../components/ui/Icon'

function Section({ icon, title, children }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon name={icon} size={18} />
        </span>
        <h2 className="text-lg font-semibold tracking-heading text-content-primary">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-content-secondary">{children}</div>
    </section>
  )
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-content-secondary">
        {n}
      </span>
      <p className="pt-0.5">{children}</p>
    </div>
  )
}

export default function Docs() {
  return (
    <MarketingPage
      eyebrow="Documentation"
      title="Getting started with NeuroSync"
      subtitle="Everything you need to send your first training job, or start earning from your own GPU."
    >
      <Section icon="plus" title="Sending a training job">
        <Step n={1}>Create an account and choose "Sender" when asked which side you're on.</Step>
        <Step n={2}>
          Open <span className="font-medium text-content-primary">New Training Job</span>, pick a foundation model,
          and upload a dataset (JSON, JSONL, or CSV — up to 50 MB).
        </Step>
        <Step n={3}>
          Review the live time and cost estimate, then pay the base fee to dispatch the job to a connected GPU.
        </Step>
        <Step n={4}>
          Watch progress in real time from the job page. Once training completes, pay the final usage-based amount
          to unlock the download.
        </Step>
      </Section>

      <Section icon="chip" title="Receiving jobs on your GPU">
        <Step n={1}>Choose "Receiver" after signup, or switch roles later from Settings.</Step>
        <Step n={2}>
          Run <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-content-primary">receiver-agent/agent.py</code>{' '}
          on the machine with the GPU, or simply start the NeuroSync backend on that machine — it auto-detects and
          registers the local GPU on startup.
        </Step>
        <Step n={3}>Incoming jobs appear on your Receiver Dashboard with live utilization and logs.</Step>
        <Step n={4}>Once a job completes, your payout appears under Earnings — 60% of the job's total value.</Step>
      </Section>

      <Section icon="activity" title="How pricing works">
        <p>
          Every job has a small base fee, scaled to the foundation model's size, paid before the job starts. Once
          training finishes, a final usage-based amount — driven by dataset size, model size, and training time — is
          billed before the trained model can be downloaded.
        </p>
        <p>
          NeuroSync keeps 40% of each job's total value; the remaining 60% goes to the receiver whose GPU ran the
          job. See the full{' '}
          <Link to="/pricing" className="font-medium text-accent hover:underline">
            pricing breakdown
          </Link>{' '}
          for exact numbers per model.
        </p>
      </Section>
    </MarketingPage>
  )
}
