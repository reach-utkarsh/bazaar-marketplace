import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/utils';
import { MockPaymentDialog } from './MockPaymentDialog';

const init = { provider: 'MOCK' as const, keyId: null, providerOrderId: 'mock_order_1', amount: 129_900, currency: 'INR', orderId: 'order_abcdefgh' };

function mockApi(mockPayResponse: unknown) {
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, opts?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost').pathname;
      calls.push({ path, body: opts?.body ? JSON.parse(String(opts.body)) : undefined });
      const body = path === '/api/payments/mock/pay' ? mockPayResponse : { status: 'paid', orderId: init.orderId };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('MockPaymentDialog', () => {
  it('is clearly labelled as a mock gateway and shows the amount', () => {
    mockApi({});
    renderWithProviders(<MockPaymentDialog init={init} onPaid={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/MOCK PAYMENT GATEWAY/)).toBeInTheDocument();
    expect(screen.getByText('₹1,299.00')).toBeInTheDocument();
  });

  it('sends the gateway result to the server for verification before reporting success', async () => {
    const calls = mockApi({ status: 'success', providerOrderId: 'mock_order_1', providerPaymentId: 'mock_pay_1', signature: 'f'.repeat(64) });
    const onPaid = vi.fn();
    renderWithProviders(<MockPaymentDialog init={init} onPaid={onPaid} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /pay successfully/i }));
    await waitFor(() => expect(onPaid).toHaveBeenCalledWith('order_abcdefgh'));
    expect(calls.map((c) => c.path)).toEqual(['/api/payments/mock/pay', '/api/payments/verify']);
    expect(calls[1].body).toEqual({ orderId: 'order_abcdefgh', providerOrderId: 'mock_order_1', providerPaymentId: 'mock_pay_1', signature: 'f'.repeat(64) });
  });

  it('shows the failure reason and does not verify on a simulated failure', async () => {
    const calls = mockApi({ status: 'failed', reason: 'Card declined' });
    const onPaid = vi.fn();
    renderWithProviders(<MockPaymentDialog init={init} onPaid={onPaid} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /simulate failure/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Card declined');
    expect(onPaid).not.toHaveBeenCalled();
    expect(calls.map((c) => c.path)).toEqual(['/api/payments/mock/pay']);
  });
});
