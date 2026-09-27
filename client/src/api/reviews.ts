import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { Paginated, Review } from '../lib/types';

export type ReviewPage = Paginated<Review> & { distribution: Record<string, number> };

export const useReviews = (productId: string, page: number) =>
  useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => api<ReviewPage>(`/products/${productId}/reviews`, { query: { page, limit: 5 } }),
    placeholderData: keepPreviousData,
  });

export function useReviewEligibility(productId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', productId, 'eligibility', user?.id],
    queryFn: () =>
      api<{ canReview: boolean; reason: string | null; existingReview: { rating: number; comment: string } | null }>(`/products/${productId}/reviews/eligibility`),
    enabled: user?.role === 'CUSTOMER',
  });
}

export function useSubmitReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rating: number; comment: string }) => api(`/products/${productId}/reviews`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', productId] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}
