import { formatINR } from '../../lib/money.js';
import { notify } from './email.service.js';

export const emails = {
  welcome(to: string, name: string) {
    notify({ to, subject: 'Welcome to Bazaar!', text: `Hi ${name},\n\nYour account is ready. Happy shopping!` });
  },
  vendorApplicationReceived(to: string, storeName: string) {
    notify({ to, subject: 'We received your vendor application',
      text: `Thanks for applying to sell as "${storeName}". An admin will review your application shortly.` });
  },
  vendorApproved(to: string, storeName: string) {
    notify({ to, subject: 'Your store has been approved 🎉',
      text: `Congratulations! "${storeName}" is now live. Sign in to your vendor dashboard to add products.` });
  },
  vendorRejected(to: string, storeName: string, reason?: string | null) {
    notify({ to, subject: 'Update on your vendor application',
      text: `Unfortunately "${storeName}" was not approved.${reason ? `\nReason: ${reason}` : ''}\nYou may re-apply at any time.` });
  },
  orderConfirmed(to: string, orderId: string, total: number) {
    notify({ to, subject: `Order ${orderId} confirmed`,
      text: `Payment received — thank you! Your order total was ${formatINR(total)}.\nTrack each shipment from your order history.` });
  },
  vendorNewOrder(to: string, subOrderId: string, subtotal: number) {
    notify({ to, subject: `New order ${subOrderId}`,
      text: `You have a new order worth ${formatINR(subtotal)}. Please pack and ship it from your dashboard.` });
  },
  subOrderStatusChanged(to: string, subOrderId: string, status: string, extra?: string) {
    notify({ to, subject: `Shipment ${subOrderId} is now ${status}`,
      text: `Your shipment ${subOrderId} status changed to ${status}.${extra ? `\n${extra}` : ''}` });
  },
  refundIssued(to: string, subOrderId: string, amount: number) {
    notify({ to, subject: `Refund issued for ${subOrderId}`,
      text: `A refund of ${formatINR(amount)} has been issued to your original payment method.` });
  },
  refundRejected(to: string, subOrderId: string, note?: string | null) {
    notify({ to, subject: `Refund request for ${subOrderId} was declined`,
      text: `Your refund request was declined.${note ? `\nNote from our team: ${note}` : ''}` });
  },
  payoutPaid(to: string, amount: number, reference?: string | null) {
    notify({ to, subject: 'Payout sent',
      text: `A payout of ${formatINR(amount)} has been sent to your account.${reference ? ` Reference: ${reference}` : ''}` });
  },
};
