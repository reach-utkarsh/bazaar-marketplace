import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthContext';
import { verifyPayment } from '../../api/payments';
import { errorMessage } from '../../lib/api';
import type { PaymentInit } from '../../lib/types';
import { MockPaymentDialog } from './MockPaymentDialog';
import { loadRazorpay, type RazorpayResponse } from './razorpay';

export function usePaymentFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mockInit, setMockInit] = useState<PaymentInit | null>(null);

  const onPaid = useCallback(
    (orderId: string) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Payment successful — your order is confirmed!');
      navigate(`/orders/${orderId}?placed=1`, { replace: true });
    },
    [navigate, qc],
  );

  const onAbandon = useCallback(
    (orderId: string) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${orderId}`, { replace: true });
    },
    [navigate, qc],
  );

  const pay = useCallback(
    async (init: PaymentInit) => {
      if (init.provider === 'MOCK') {
        setMockInit(init);
        return;
      }
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: init.keyId,
        amount: init.amount,
        currency: init.currency,
        order_id: init.providerOrderId,
        name: 'Bazaar',
        description: `Order ${init.orderId.slice(-8).toUpperCase()}`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#4f46e5' },
        handler: async (resp: RazorpayResponse) => {
          try {
            await verifyPayment(init.orderId, {
              providerOrderId: resp.razorpay_order_id,
              providerPaymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            });
            onPaid(init.orderId);
          } catch (err) {
            toast.error(errorMessage(err));
            onAbandon(init.orderId);
          }
        },
        modal: { ondismiss: () => onAbandon(init.orderId) },
      });
      rzp.on('payment.failed', (r) => toast.error(`Payment failed: ${r.error.description}`));
      rzp.open();
    },
    [user, onPaid, onAbandon],
  );

  const dialog = (
    <MockPaymentDialog
      init={mockInit}
      onPaid={(orderId) => {
        setMockInit(null);
        onPaid(orderId);
      }}
      onClose={() => {
        const id = mockInit?.orderId;
        setMockInit(null);
        if (id) onAbandon(id);
      }}
    />
  );

  return { pay, dialog };
}
