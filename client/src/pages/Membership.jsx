import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Icon } from '../components/ui/Icon'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import { trpc } from '../lib/trpc'

function readableStatus(status) {
  return String(status || 'free').replaceAll('_', ' ')
}

export default function Membership() {
  const [searchParams] = useSearchParams()
  const { membership, beginPremiumTrial } = useData()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const checkout = trpc.workspace.createPremiumCheckout.useMutation()
  const portal = trpc.workspace.createPremiumBillingPortal.useMutation()
  const cancelTrial = trpc.workspace.cancelPremiumTrial.useMutation()
  const [working, setWorking] = useState(false)

  const isPremium = membership?.plan === 'premium' && ['active', 'trialing'].includes(membership?.status)
  const trial = membership?.status === 'trialing'
  const notice = useMemo(() => searchParams.get('premium'), [searchParams])

  const refresh = async () => {
    await utils.workspace.membership.invalidate()
  }
  const startCheckout = async () => {
    setWorking(true)
    try {
      const result = await checkout.mutateAsync()
      window.location.assign(result.url)
    } catch (error) {
      toast.error(error.message || 'Premium Checkout could not be opened.')
      setWorking(false)
    }
  }
  const startTrial = async () => {
    setWorking(true)
    try {
      await beginPremiumTrial()
      await refresh()
      toast.success('Your 14-day Premium trial is active.')
    } catch (error) {
      toast.error(error.message || 'The Premium trial could not be started.')
    } finally { setWorking(false) }
  }
  const manageBilling = async () => {
    setWorking(true)
    try {
      const result = await portal.mutateAsync()
      window.location.assign(result.url)
    } catch (error) {
      toast.error(error.message || 'Billing management could not be opened.')
      setWorking(false)
    }
  }
  const revokeTrial = async () => {
    setWorking(true)
    try {
      await cancelTrial.mutateAsync()
      await refresh()
      toast.success('Your Premium trial has been revoked.')
    } catch (error) {
      toast.error(error.message || 'The Premium trial could not be revoked.')
    } finally { setWorking(false) }
  }

  return (
    <PageContainer>
      <PageHeader title="Premium & billing" description="View your membership, unlock distributed training, and manage cancellation from one place." />
      {notice === 'success' && <div className="mb-5 rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">Checkout returned successfully. Your membership will update as soon as Stripe confirms the subscription.</div>}
      {notice === 'cancelled' && <div className="mb-5 rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">Premium Checkout was cancelled. Your current plan has not changed.</div>}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Current membership</p>
              <h2 className="mt-1 text-2xl font-semibold text-content-primary">{isPremium ? 'NeuroSync Premium' : 'NeuroSync Free'}</h2>
              <p className="mt-2 text-sm text-content-secondary">Status: <span className="capitalize text-content-primary">{readableStatus(membership?.status)}</span>{membership?.trialEndsAt ? ` · Trial ends ${new Date(membership.trialEndsAt).toLocaleDateString()}` : ''}</p>
            </div>
            <Badge tone={isPremium ? 'success' : 'neutral'}>{isPremium ? (trial ? 'Trialing' : 'Active') : 'Free plan'}</Badge>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['Single-GPU fine-tuning', 'Included on every plan'],
              ['Distributed fine-tuning', isPremium ? 'Per-step and adaptive synchronization unlocked' : 'Premium required'],
              ['Live receiver coordination', 'Included on every plan'],
              ['Billing control', membership?.stripeCustomerId ? 'Managed securely in Stripe' : trial ? 'Trial can be revoked here' : 'Available after Premium Checkout'],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-3"><p className="text-sm font-medium text-content-primary">{label}</p><p className="mt-1 text-xs text-content-secondary">{value}</p></div>)}
          </div>
        </Card>
        <Card className="bg-surface-raised">
          <Icon name="star" className="text-accent" size={24} />
          <h2 className="mt-3 text-lg font-semibold text-content-primary">Premium membership</h2>
          <p className="mt-2 text-sm text-content-secondary">Coordinate multiple receivers, choose per-step or adaptive synchronization, and monitor persisted shard checkpoints.</p>
          <div className="mt-5 grid gap-2">
            {!isPremium && <Button loading={working || checkout.isPending} onClick={startCheckout}>Buy Premium</Button>}
            {!isPremium && <Button variant="secondary" loading={working} onClick={startTrial}>Start 14-day trial</Button>}
            {membership?.stripeCustomerId && <Button variant="secondary" loading={working || portal.isPending} onClick={manageBilling}>Manage billing or cancel</Button>}
            {trial && !membership?.stripeCustomerId && <Button variant="danger" loading={working || cancelTrial.isPending} onClick={revokeTrial}>Revoke trial</Button>}
          </div>
          <p className="mt-4 text-xs text-content-muted">Stripe processes Premium billing. NeuroSync does not store card numbers or payment credentials.</p>
        </Card>
      </div>
    </PageContainer>
  )
}
