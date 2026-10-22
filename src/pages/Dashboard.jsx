/**
 * Dashboard (PRD Section 1). A welcoming workspace: a time-based greeting, a
 * prominent "New Training Job" action, quick stats, and a Recent Jobs section
 * that shows a friendly empty state until the first job is created. The layout
 * already accommodates Running / Completed / Failed / Queued jobs.
 */

import { Link } from 'react-router-dom'
import { Reveal, RevealGroup } from '../components/motion/Reveal'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { PageContainer } from '../components/ui/PageContainer'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { EmptyState } from '../components/ui/EmptyState'
import { JobCard } from '../components/JobCard'
import { StatTile } from '../components/ui/StatTile'
import { isActiveStatus, isTerminalStatus, JOB_STATUS } from '../services/trainingSimulator'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function firstName(fullName = '') {
  return fullName.trim().split(/\s+/)[0] || 'there'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { jobs, models, getJobState } = useData()

  const activeJobs = jobs.filter((job) => isActiveStatus(job.status))
  const completedCount = jobs.filter((job) => job.status === JOB_STATUS.COMPLETED).length
  const failedCount = jobs.filter((job) => isTerminalStatus(job.status) && job.status !== JOB_STATUS.COMPLETED).length
  const recentJobs = jobs.slice(0, 4)
  const hasJobs = jobs.length > 0

  return (
    <PageContainer>
      <div className="animate-ns-settle">
      {/* Welcome */}
      <section className="mb-8">
        <p className="text-sm font-medium text-accent">{greeting()}, {firstName(user?.fullName)}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-heading text-content-primary sm:text-3xl">
          Welcome to NeuroSync
        </h1>
        <p className="mt-1.5 max-w-xl text-content-secondary">
          {hasJobs
            ? 'Here is an overview of your fine-tuning workspace.'
            : 'Create your first AI fine-tuning job to begin.'}
        </p>
      </section>

      {/* Primary action / empty hero */}
      {!hasJobs ? (
        <section className="mb-8 flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="chip" size={28} />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-content-primary">Start your first training job</h2>
          <p className="mt-1.5 max-w-md text-sm text-content-secondary">
            Select a GPU receiver, choose a foundation model, upload your dataset and configure training — all in one
            guided workspace.
          </p>
          <Link to="/jobs/new" className="mt-6">
            <Button size="lg" icon="plus">
              New Training Job
            </Button>
          </Link>
        </section>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Active" value={activeJobs.length} icon="activity" tone="blue" />
            <StatTile label="Completed" value={completedCount} icon="checkCircle" tone="accent" />
            <StatTile label="Failed" value={failedCount} icon="alert" tone="amber" />
            <StatTile label="Models" value={models.length} icon="cube" />
          </section>

          <section className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <h2 className="text-base font-semibold text-content-primary">Ready to train another model?</h2>
              <p className="mt-0.5 text-sm text-content-secondary">Spin up a new fine-tuning job in a few clicks.</p>
            </div>
            <Link to="/jobs/new">
              <Button icon="plus">New Training Job</Button>
            </Link>
          </section>
        </>
      )}

      {/* Recent jobs */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-content-primary">Recent Jobs</h2>
          {hasJobs && (
            <Link to="/jobs/active" className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          )}
        </div>

        {!hasJobs ? (
          <EmptyState
            icon="layers"
            title="No training jobs yet"
            description="When you create your first training job it will appear here."
          />
        ) : (
          <RevealGroup as="div" className="grid gap-4" stagger={56}>
            {recentJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                state={getJobState(job)}
                variant={
                  isActiveStatus(job.status)
                    ? 'active'
                    : job.status === JOB_STATUS.COMPLETED
                    ? 'completed'
                    : 'failed'
                }
              />
            ))}
          </RevealGroup>
        )}
      </section>
      </div>
    </PageContainer>
  )
}
