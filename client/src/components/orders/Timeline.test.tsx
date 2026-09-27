import { render, screen } from '@testing-library/react';
import type { SubOrder } from '../../lib/types';
import { ShipmentProgress } from './Timeline';

const sub = (overrides: Partial<SubOrder> = {}): SubOrder => ({
  id: 's1', orderId: 'o1', vendorId: 'v1', status: 'PLACED', subtotal: 1000, commissionRateBps: 1000, commissionAmount: 100,
  vendorEarnings: 900, trackingNumber: null, carrier: null, cancelReason: null, refundedAmount: 0, packedAt: null, shippedAt: null,
  deliveredAt: null, cancelledAt: null, createdAt: new Date().toISOString(), items: [], ...overrides,
});

describe('ShipmentProgress', () => {
  it('marks the current step', () => {
    render(<ShipmentProgress subOrder={sub({ status: 'SHIPPED', packedAt: new Date().toISOString(), shippedAt: new Date().toISOString() })} paid />);
    const current = screen.getByText('Shipped').closest('li')!.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(screen.getByText('Delivered').closest('li')!.querySelector('[aria-current]')).toBeNull();
  });

  it('shows the cancellation reason instead of steps', () => {
    render(<ShipmentProgress subOrder={sub({ status: 'CANCELLED', cancelReason: 'Out of stock' })} paid />);
    expect(screen.getByText(/Cancelled — Out of stock/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Shipment progress')).not.toBeInTheDocument();
  });

  it('shows no completed steps for an unpaid order', () => {
    const { container } = render(<ShipmentProgress subOrder={sub()} paid={false} />);
    expect(container.querySelector('[aria-current="step"]')).toBeNull();
  });
});
