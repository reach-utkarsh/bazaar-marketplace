import { BadgeCheck, MessageSquare } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useReviewEligibility, useReviews, useSubmitReview } from '../../api/reviews';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { StarInput, Stars } from '../../components/ui/Stars';
import { formatDate } from '../../lib/format';
import type { Product } from '../../lib/types';

export function ReviewsSection({ product }: { product: Product }) {
  const [page, setPage] = useState(1);
  const reviews = useReviews(product.id, page);

  return (
    <section id="reviews" className="mt-12 scroll-mt-24">
      <h2 className="mb-4 text-xl font-bold text-slate-900">Customer reviews</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-slate-900">{product.reviewCount ? product.avgRating.toFixed(1) : '—'}</span>
              <div>
                <Stars value={product.avgRating} size="md" />
                <p className="text-sm text-slate-500">{product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}</p>
              </div>
            </div>
            {reviews.data && product.reviewCount > 0 && (
              <ul className="mt-4 space-y-1.5" aria-label="Rating distribution">
                {[5, 4, 3, 2, 1].map((r) => {
                  const n = reviews.data.distribution[r] ?? 0;
                  const pct = product.reviewCount ? (n / product.reviewCount) * 100 : 0;
                  return (
                    <li key={r} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-6">{r}★</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <ReviewForm productId={product.id} />
        </div>
        <div>
          {reviews.isPending ? (
            <div className="flex justify-center py-10"><Spinner className="h-6 w-6 text-brand-600" /></div>
          ) : reviews.isError ? (
            <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
          ) : reviews.data.items.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-500">
              <MessageSquare className="mb-2 h-6 w-6" />
              <p className="text-sm">No reviews yet. Buyers can review after delivery.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {reviews.data.items.map((r) => (
                  <li key={r.id}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Stars value={r.rating} />
                          <span className="text-sm font-medium text-slate-900">{r.user.name}</span>
                          <span className="flex items-center gap-0.5 text-xs text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified buyer</span>
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{r.comment}</p>
                    </Card>
                  </li>
                ))}
              </ul>
              <Pagination page={page} totalPages={reviews.data.totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewForm({ productId }: { productId: string }) {
  const eligibility = useReviewEligibility(productId);
  const submit = useSubmitReview(productId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const existing = eligibility.data?.existingReview;
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment);
    }
  }, [existing]);

  if (!eligibility.data?.canReview) {
    return eligibility.data ? <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{eligibility.data.reason}</p> : null;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await submit.mutateAsync({ rating, comment: comment.trim() });
    toast.success(existing ? 'Review updated' : 'Thanks for your review!');
  };

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{existing ? 'Update your review' : 'Write a review'}</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <StarInput value={rating} onChange={setRating} />
        <Textarea label="Your review" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} hint="At least 10 characters" />
        <Button type="submit" className="w-full" loading={submit.isPending} disabled={rating === 0 || comment.trim().length < 10}>
          {existing ? 'Update review' : 'Submit review'}
        </Button>
      </form>
    </Card>
  );
}
