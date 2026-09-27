import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCategories } from '../../api/catalog';
import { useDeleteImage, useSaveProduct, useUploadImages, useVendorProduct } from '../../api/vendor';
import { ProductImage } from '../../components/product/ProductImage';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { PageLoader } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { ApiError } from '../../lib/api';
import { paiseToRupees, rupeesToPaise } from '../../lib/format';

type Errors = Partial<Record<'title' | 'description' | 'price' | 'stock' | 'categoryId', string>>;

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const categories = useCategories();
  const existing = useVendorProduct(id);
  const save = useSaveProduct(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (existing.data) {
      const p = existing.data;
      setTitle(p.title);
      setDescription(p.description);
      setPrice(String(paiseToRupees(p.price)));
      setStock(String(p.stock));
      setCategoryId(p.categoryId);
      setIsActive(p.isActive);
    }
  }, [existing.data]);

  if (isEdit && existing.isPending) return <PageLoader />;
  if (isEdit && existing.isError) return <ErrorState error={existing.error} />;

  const validateForm = (): Errors => {
    const e: Errors = {};
    if (title.trim().length < 3) e.title = 'At least 3 characters';
    if (description.trim().length < 10) e.description = 'At least 10 characters';
    if (!(Number(price) >= 1)) e.price = 'Minimum price is ₹1';
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0 || stock === '') e.stock = 'Whole number, 0 or more';
    if (!categoryId) e.categoryId = 'Choose a category';
    return e;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const v = validateForm();
    setErrors(v);
    if (Object.keys(v).length) return;
    try {
      const product = await save.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        price: rupeesToPaise(Number(price)),
        stock: Number(stock),
        categoryId,
        isActive,
      });
      toast.success(isEdit ? 'Product updated' : 'Product created — now add some photos');
      if (!isEdit) navigate(`/vendor/products/${product.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const fe: Errors = {};
        for (const d of err.details) fe[d.path.replace('body.', '') as keyof Errors] = d.message;
        setErrors(fe);
      }
    }
  };

  return (
    <>
      <Link to="/vendor/products" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>
      <PageHeader title={isEdit ? 'Edit product' : 'New product'} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Details" />
          <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={120} />
            <Textarea label="Description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={5000} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Price (₹)" type="number" min={1} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
              <Input label="Stock" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} error={errors.stock} />
              <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={errors.categoryId}>
                <option value="">Select…</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Visible in the store
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => navigate('/vendor/products')}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>{isEdit ? 'Save changes' : 'Create product'}</Button>
            </div>
          </form>
        </Card>
        {isEdit && existing.data ? (
          <ImageManager productId={existing.data.id} images={existing.data.images} />
        ) : (
          <Card className="p-5 text-sm text-slate-500">You can upload photos after creating the product.</Card>
        )}
      </div>
    </>
  );
}

function ImageManager({ productId, images }: { productId: string; images: { id: string; url: string }[] }) {
  const upload = useUploadImages(productId);
  const remove = useDeleteImage(productId);
  const input = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    await upload.mutateAsync(Array.from(files));
    toast.success('Images uploaded');
    if (input.current) input.current.value = '';
  };

  return (
    <Card>
      <CardHeader title="Images" description="JPG, PNG, WebP or GIF · up to 5 MB each · max 8" />
      <div className="p-5">
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
              <ProductImage url={img.url} alt="" className="h-full w-full" />
              <button
                onClick={() => remove.mutate(img.id)}
                className="absolute top-1 right-1 rounded-md bg-white/90 p-1 text-rose-600 opacity-0 shadow group-hover:opacity-100 focus:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <button
              onClick={() => input.current?.click()}
              disabled={upload.isPending}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600"
            >
              <ImagePlus className="h-5 w-5" />
              {upload.isPending ? 'Uploading…' : 'Add'}
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
    </Card>
  );
}
