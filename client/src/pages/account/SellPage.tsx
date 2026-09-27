import { CheckCircle2, Clock, Store, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApplyVendor } from '../../api/vendor';
import { useAuth } from '../../auth/AuthContext';
import { ButtonLink, Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Form';

export default function SellPage() {
  const { user, reloadUser } = useAuth();
  const apply = useApplyVendor();
  const vendor = user?.vendor;
  const [storeName, setStoreName] = useState(vendor?.storeName ?? '');
  const [description, setDescription] = useState('');

  if (!user) {
    return (
      <Intro>
        <div className="flex gap-3">
          <ButtonLink to="/register?redirect=/sell">Create an account</ButtonLink>
          <ButtonLink to="/login?redirect=/sell" variant="secondary">Sign in</ButtonLink>
        </div>
      </Intro>
    );
  }

  if (user.role === 'ADMIN') {
    return <Intro><p className="text-sm text-slate-600">Admin accounts can’t open a store.</p></Intro>;
  }

  if (vendor?.status === 'APPROVED') {
    return (
      <StatusCard icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />} title={`${vendor.storeName} is live`}>
        <ButtonLink to="/vendor">Go to vendor dashboard</ButtonLink>
      </StatusCard>
    );
  }

  if (vendor?.status === 'PENDING') {
    return (
      <StatusCard icon={<Clock className="h-6 w-6 text-amber-600" />} title="Your application is under review">
        <p className="text-sm text-slate-600">
          We’re reviewing <strong>{vendor.storeName}</strong>. You’ll get an email as soon as an admin approves it.
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => reloadUser()}>
          Refresh status
        </Button>
      </StatusCard>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await apply.mutateAsync({ storeName, description });
    await reloadUser();
    toast.success('Application submitted! We’ll review it shortly.');
  };

  return (
    <Intro>
      {vendor?.status === 'REJECTED' && (
        <div className="mb-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <XCircle className="h-5 w-5 shrink-0" />
          <div>
            Your previous application was not approved.
            {vendor.rejectionReason && <> Reason: <em>{vendor.rejectionReason}</em>.</>} You can update it and apply again.
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Store name" required minLength={3} maxLength={60} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        <Textarea
          label="Tell customers about your store"
          required
          minLength={20}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint="What do you sell? What makes it special? (20+ characters)"
        />
        <Button type="submit" loading={apply.isPending}>
          Submit application
        </Button>
      </form>
    </Intro>
  );
}

function Intro({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-brand-100 p-3 text-brand-700"><Store className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sell on Bazaar</h1>
          <p className="text-sm text-slate-500">Reach new customers. We handle checkout, payments and payouts — you focus on your products.</p>
        </div>
      </div>
      <Card className="p-6">{children}</Card>
    </div>
  );
}

function StatusCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg">
      <Card className="p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">{icon}</div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">{title}</h1>
        {children}
      </Card>
    </div>
  );
}
