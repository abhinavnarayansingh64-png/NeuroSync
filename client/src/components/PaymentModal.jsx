/**
 * PaymentModal — simulated checkout used for both the base fee (before a
 * job starts) and the final, usage-based payment (before a trained model
 * can be downloaded). Built entirely from the existing design system
 * (Modal + Button) so it looks native to the rest of the app.
 */

import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { formatInr } from '../services/pricing'

export function PaymentModal({ open, onClose, title, description, amountInr, onConfirm, processingLabel = 'Authorizing payment' }) {
  const [processing, setProcessing] = useState(false)

  const handlePay = async () => {
    setProcessing(true)
    try {
      await onConfirm()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="rounded-xl border border-border bg-surface p-5 text-center">
        <p className="text-3xl font-semibold tabular-nums text-content-primary">{formatInr(amountInr)}</p>
        <p className="mt-1 text-xs text-content-muted">UPI · Card · Netbanking</p>
      </div>
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" fullWidth onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button fullWidth onClick={handlePay} loading={processing}>
          {processing ? processingLabel : 'Authorize & start'}
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-content-muted">
        Job settlement is simulated while the external GPU provider is in simulation mode. Premium membership billing is processed securely through Stripe.
      </p>
    </Modal>
  )
}
