/**
 * FailedJobs (PRD Section 5: Failed Jobs). Lists failed and cancelled jobs
 * with the failure reason and last completed step, plus retry / view-logs /
 * delete actions.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { RevealGroup } from '../components/motion/Reveal'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { JobCard } from '../components/JobCard'
import { isTerminalStatus, JOB_STATUS } from '../constants/jobStatus'

export default function FailedJobs() {
  const { jobs, getJobState, deleteJob, startJob } = useData()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState(null)

  const failedJobs = jobs.filter(
    (job) => isTerminalStatus(job.status) && job.status !== JOB_STATUS.COMPLETED,
  )

  const retry = (job) => {
    const newJob = startJob(job.config)
    toast.success(`Retrying · new job ${newJob.id}`)
    navigate(`/jobs/${newJob.id}`)
  }

  return (
    <PageContainer>
      <PageHeader title="Failed Jobs" description="Jobs that stopped before completing, with recovery options." />

      {failedJobs.length === 0 ? (
        <EmptyState
          icon="alert"
          title="No failed jobs"
          description="Cancelled or failed training jobs will appear here so you can retry them."
        />
      ) : (
        <RevealGroup as="div" className="grid gap-4" stagger={56}>
          {failedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              state={getJobState(job)}
              variant="failed"
              actions={
                <>
                  <Button variant="secondary" size="sm" icon="refresh" onClick={() => retry(job)}>
                    Retry
                  </Button>
                  <Button variant="danger" size="sm" icon="trash" onClick={() => setDeleteId(job.id)}>
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </RevealGroup>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          deleteJob(deleteId)
          setDeleteId(null)
          toast.success('Job deleted')
        }}
        title="Delete this job?"
        description="This permanently removes the job and its logs from your workspace."
        confirmLabel="Delete job"
      />
    </PageContainer>
  )
}
