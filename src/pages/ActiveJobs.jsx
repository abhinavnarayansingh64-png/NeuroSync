/**
 * ActiveJobs (PRD Section 5: Active Job Management). Lists every in-flight
 * job with inline pause/resume/cancel controls and quick access to details.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { RevealGroup } from '../components/motion/Reveal'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { JobCard } from '../components/JobCard'
import { isActiveStatus, JOB_STATUS } from '../services/trainingSimulator'

export default function ActiveJobs() {
  const { jobs, getJobState, pauseJob, resumeJob, cancelJob } = useData()
  const { toast } = useToast()
  const [cancelId, setCancelId] = useState(null)

  const activeJobs = jobs.filter((job) => isActiveStatus(job.status))

  return (
    <PageContainer>
      <PageHeader
        title="Active Jobs"
        description="Monitor and manage training jobs currently in progress."
        actions={
          <Link to="/jobs/new">
            <Button icon="plus">New Job</Button>
          </Link>
        }
      />

      {activeJobs.length === 0 ? (
        <EmptyState
          icon="activity"
          title="No active training jobs"
          description="Start a new fine-tuning job and it will appear here while it runs."
          action={
            <Link to="/jobs/new">
              <Button>New Training Job</Button>
            </Link>
          }
        />
      ) : (
        <RevealGroup as="div" className="grid gap-4" stagger={56}>
          {activeJobs.map((job) => {
            const paused = job.status === JOB_STATUS.PAUSED
            return (
              <JobCard
                key={job.id}
                job={job}
                state={getJobState(job)}
                variant="active"
                actions={
                  <>
                    {paused ? (
                      <Button variant="secondary" size="sm" icon="play" onClick={() => resumeJob(job.id)}>
                        Resume
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" icon="pause" onClick={() => pauseJob(job.id)}>
                        Pause
                      </Button>
                    )}
                    <Button variant="danger" size="sm" icon="stop" onClick={() => setCancelId(job.id)}>
                      Cancel
                    </Button>
                  </>
                }
              />
            )
          })}
        </RevealGroup>
      )}

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={() => {
          cancelJob(cancelId)
          setCancelId(null)
          toast.warning('Training cancelled')
        }}
        title="Cancel this training job?"
        description="The job will stop and move to Failed. This cannot be undone."
        confirmLabel="Cancel training"
        cancelLabel="Keep training"
      />
    </PageContainer>
  )
}
