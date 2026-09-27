import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeProduct } from '../../test/fixtures';
import { renderWithProviders, testUser } from '../../test/utils';
import { ReviewsSection } from './ReviewsSection';

afterEach(() => vi.unstubAllGlobals());

function stubApi(eligibility: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), 'http://localhost').pathname;
      const body = path.endsWith('/eligibility')
        ? eligibility
        : {
            items: [{ id: 'r1', rating: 5, comment: 'Gorgeous lamp, great finish.', createdAt: new Date().toISOString(), user: { id: 'u2', name: 'Rahul V.' } }],
            page: 1, limit: 5, total: 1, totalPages: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
          };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

describe('ReviewsSection', () => {
  it('lists reviews with a verified-buyer badge', async () => {
    stubApi({ canReview: false, reason: 'Only customers who received this product can review it', existingReview: null });
    renderWithProviders(<ReviewsSection product={makeProduct({ reviewCount: 1, avgRating: 5 })} />, { user: testUser() });
    expect(await screen.findByText('Gorgeous lamp, great finish.')).toBeInTheDocument();
    expect(screen.getByText('Verified buyer')).toBeInTheDocument();
    expect(await screen.findByText(/Only customers who received/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit review/i })).not.toBeInTheDocument();
  });

  it('lets an eligible buyer submit once a rating and comment are given', async () => {
    stubApi({ canReview: true, reason: null, existingReview: null });
    renderWithProviders(<ReviewsSection product={makeProduct()} />, { user: testUser() });
    const submit = await screen.findByRole('button', { name: /submit review/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await userEvent.type(screen.getByLabelText('Your review'), 'Solid and well made.');
    expect(submit).toBeEnabled();
  });
});
