import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, testUser } from '../../test/utils';
import AdminSettingsPage from './AdminSettingsPage';

afterEach(() => vi.unstubAllGlobals());

describe('AdminSettingsPage', () => {
  it('previews the split and saves the commission in basis points', async () => {
    const calls: { method: string; body?: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, opts?: RequestInit) => {
        calls.push({ method: opts?.method ?? 'GET', body: opts?.body as string | undefined });
        const body = opts?.method === 'PATCH' ? JSON.parse(String(opts.body)) : { commissionRateBps: 1000 };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    renderWithProviders(<AdminSettingsPage />, { user: testUser({ role: 'ADMIN' }) });
    const input = await screen.findByLabelText('Commission rate (%)');
    expect(input).toHaveValue(10);
    expect(screen.getByText(/platform keeps/)).toHaveTextContent('₹100.00');

    await userEvent.clear(input);
    await userEvent.type(input, '12.5');
    expect(screen.getByText(/platform keeps/)).toHaveTextContent('₹125.00');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!)).toEqual({ commissionRateBps: 1250 });
  });

  it('rejects out-of-range values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ commissionRateBps: 1000 }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    renderWithProviders(<AdminSettingsPage />, { user: testUser({ role: 'ADMIN' }) });
    const input = await screen.findByLabelText('Commission rate (%)');
    await userEvent.clear(input);
    await userEvent.type(input, '75');
    expect(screen.getByText('Enter a value between 0 and 50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
