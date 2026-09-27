import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useCreateCategory, useDeleteCategory, useRenameCategory } from '../../api/admin';
import { useCategories } from '../../api/catalog';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { controlClass } from '../../components/ui/Form';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';

export default function AdminCategoriesPage() {
  const categories = useCategories();
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    await create.mutateAsync(name.trim());
    toast.success('Category created');
    setName('');
  };

  return (
    <>
      <PageHeader title="Categories" description="Organise the catalog. Categories with products can’t be deleted." />
      <Card className="mb-4 p-4">
        <form onSubmit={onCreate} className="flex gap-2">
          <input aria-label="New category name" className={controlClass} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      </Card>
      {categories.isPending ? (
        <PageLoader />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : categories.data.length === 0 ? (
        <EmptyState icon={<Tags className="h-6 w-6" />} title="No categories yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {categories.data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                {editing?.id === c.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await rename.mutateAsync(editing);
                      toast.success('Category renamed');
                      setEditing(null);
                    }}
                  >
                    <input aria-label="Category name" autoFocus className={controlClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    <Button type="submit" size="sm" loading={rename.isPending} aria-label="Save"><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">/{c.slug} · {c.productCount ?? 0} active products</p>
                    </div>
                    <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`Rename ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      onClick={async () => {
                        await del.mutateAsync(c.id);
                        toast.success('Category deleted');
                      }}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
