/**
 * CompletedJobs (PRD Section 5: Completed Jobs). Lists successfully finished
 * jobs with options to view details, download logs, download the model
 * manifest, and delete.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { RevealGroup } from '../components/motion/Reveal'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { JobCard } from '../components/JobCard'
import { JOB_STATUS } from '../constants/jobStatus'
import { downloadTextFile } from '../utils/download'

export default function CompletedJobs() {
  const { jobs, getJobState, deleteJob } = useData()
  const { toast } = useToast()
  const [deleteId, setDeleteId] = useState(null)

  const completedJobs = jobs.filter((job) => job.status === JOB_STATUS.COMPLETED)

  const downloadLogs = (job) => {
    const text = (job.logs || [])
      .map((log) => `${(log.level || 'info').toUpperCase()}  ${log.message}`)
      .join('\n')
    downloadTextFile(`${job.id}-logs.txt`, text || 'No logs available.')
    toast.success('Logs downloaded')
  }

  return (
    <PageContainer>
      <PageHeader title="Completed Jobs" description="Fine-tuning jobs that finished successfully." />

      {completedJobs.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title="No completed jobs yet"
          description="Completed training jobs and their trained models will appear here."
          action={
            <Link to="/jobs/new">
              <Button>New Training Job</Button>
            </Link>
          }
        />
      ) : (
        <RevealGroup as="div" className="grid gap-4" stagger={56}>
          {completedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              state={getJobState(job)}
              variant="completed"
              actions={
                <>
                  <Button variant="ghost" size="sm" icon="download" onClick={() => downloadLogs(job)}>
                    Logs
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
