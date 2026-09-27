import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useCommission, useSetCommission } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Form';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { formatMoney } from '../../lib/format';

export default function AdminSettingsPage() {
  const current = useCommission();
  const save = useSetCommission();
  const [percent, setPercent] = useState('');

  useEffect(() => {
    if (current.data) setPercent(String(current.data.commissionRateBps / 100));
  }, [current.data]);

  if (current.isPending) return <PageLoader />;
  if (current.isError) return <ErrorState error={current.error} onRetry={() => current.refetch()} />;

  const value = Number(percent);
  const invalid = percent === '' || Number.isNaN(value) || value < 0 || value > 50;
  const bps = Math.round(value * 100);
  const example = 100_000; // ₹1,000

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    await save.mutateAsync(bps);
    toast.success(`Commission set to ${value}%`);
  };

  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-xl">
        <CardHeader title="Platform commission" description="Applied to new orders. Existing orders keep the rate they were placed with." />
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <Input
            label="Commission rate (%)"
            type="number"
            min={0}
            max={50}
            step={0.01}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            error={invalid ? 'Enter a value between 0 and 50' : undefined}
          />
          {!invalid && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              On a {formatMoney(example)} sale the platform keeps <strong>{formatMoney(Math.round((example * bps) / 10000))}</strong> and the vendor earns{' '}
              <strong>{formatMoney(example - Math.round((example * bps) / 10000))}</strong>.
            </p>
          )}
          <Button type="submit" loading={save.isPending} disabled={invalid || bps === current.data.commissionRateBps}>
            Save
          </Button>
        </form>
      </Card>
    </>
  );
}
