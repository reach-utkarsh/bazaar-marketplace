import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-6">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
        {children}
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
    </div>
  );
}
