/**
 * PricingPage — real content behind the navbar's "Pricing" link (previously
 * the dead #github anchor). Shows the base fee for every foundation model
 * and explains how the final, usage-based payment and receiver payout work.
 */

import { Link } from 'react-router-dom'
import { MarketingPage } from '../components/MarketingPage'
import { trpc } from '../lib/trpc'
import { formatInr } from '../services/pricing'

export default function PricingPage() {
  const catalog = trpc.catalog.baseModels.useQuery(undefined, { staleTime: 30_000 })
  const models = catalog.data || []

  return (
    <MarketingPage
      eyebrow="Pricing"
      title="Simple, size-based pricing"
      subtitle="Every model has a small base fee, paid before your job starts. The rest is billed on actual training time, after the model is trained."
    >
      <section>
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Parameters</th>
                <th className="px-4 py-3 font-medium">Base fee</th>
                <th className="px-4 py-3 font-medium">Hourly rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models.map((model) => (
                <tr key={model.id} className="bg-card">
                  <td className="px-4 py-3 font-medium text-content-primary">{model.name}</td>
                  <td className="px-4 py-3 text-content-secondary">{model.sizeLabel}</td>
                  <td className="px-4 py-3 font-medium text-accent">{formatInr(Number(model.baseFeeInr))}</td>
                  <td className="px-4 py-3 text-content-secondary">{formatInr(model.hourlyRateInr)}/hr</td>
                </tr>
              ))}
              {catalog.isLoading && (
                <tr className="bg-card"><td colSpan="4" className="px-4 py-5 text-content-secondary">Loading current server-backed pricing…</td></tr>
              )}
              {catalog.isError && (
                <tr className="bg-card"><td colSpan="4" className="px-4 py-5 text-status-danger">Pricing is temporarily unavailable. Please try again shortly.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-heading text-content-primary">How the final amount is set</h2>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          After you pick a model and upload a dataset, NeuroSync estimates training time from the dataset's file
          size and the model's throughput, and projects a total cost. You pay the base fee up front to dispatch the
          job; once training completes, the remaining usage-based amount is billed before your trained model
          unlocks for download. A roughly 10 MB dataset typically lands around 2-3 hours of training time on a
          mid-size model.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-heading text-content-primary">What receivers earn</h2>
        <p className="mt-3 text-sm leading-relaxed text-content-secondary">
          NeuroSync keeps 40% of each job's total value to run the platform; the receiver whose GPU trained the job
          keeps the remaining 60%, visible on their{' '}
          <span className="font-medium text-content-primary">Earnings</span> panel as soon as the job completes.
        </p>
      </section>

      <div>
        <Link to="/signup" className="text-sm font-medium text-accent hover:underline">
          Create an account to get started →
        </Link>
      </div>
    </MarketingPage>
  )
}
