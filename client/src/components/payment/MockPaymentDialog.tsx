import { CreditCard, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { formatMoney, shortId } from '../../lib/format';
import type { PaymentInit } from '../../lib/types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { verifyPayment, type GatewayResult } from '../../api/payments';

type MockResult = ({ status: 'success' } & GatewayResult) | { status: 'failed'; reason: string };

/**
 * ⚠️ MOCK payment gateway UI, shown only when the server has no Razorpay keys.
 * It exercises the same server-side verification path as the real gateway.
 */
export function MockPaymentDialog({ init, onPaid, onClose }: { init: PaymentInit | null; onPaid: (orderId: string) => void; onClose: () => void }) {
  const [busy, setBusy] = useState<'success' | 'failure' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!init) return null;

  const run = async (outcome: 'success' | 'failure') => {
    setBusy(outcome);
    setError(null);
    try {
      const r = await api<MockResult>('/payments/mock/pay', { method: 'POST', body: { orderId: init.orderId, outcome } });
      if (r.status === 'failed') {
        setError(`${r.reason}. Your items are reserved — you can retry.`);
        return;
      }
      await verifyPayment(init.orderId, r);
      onPaid(init.orderId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Complete payment">
      <div className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <FlaskConical className="h-5 w-5 shrink-0" />
        <p>
          <strong>MOCK PAYMENT GATEWAY.</strong> Razorpay keys aren’t configured, so this simulated gateway is used. No real money moves; the
          server still verifies an HMAC signature before confirming the order.
        </p>
      </div>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Order {shortId(init.orderId)}</p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">{formatMoney(init.amount)}</p>
        <p className="mt-1 font-mono text-xs text-slate-400">{init.providerOrderId}</p>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button variant="success" size="lg" loading={busy === 'success'} disabled={!!busy} onClick={() => run('success')}>
          <CreditCard className="h-5 w-5" /> Pay successfully
        </Button>
        <Button variant="secondary" size="lg" loading={busy === 'failure'} disabled={!!busy} onClick={() => run('failure')}>
          Simulate failure
        </Button>
      </div>
      <button onClick={onClose} disabled={!!busy} className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-800">
        Pay later — keep my order
      </button>
    </Modal>
  );
}
