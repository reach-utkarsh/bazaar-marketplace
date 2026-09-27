import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { ApiError, errorMessage } from '../../lib/api';
import { AuthShell } from './AuthShell';
import { postLoginPath } from './redirect';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

function validateClient(name: string, email: string, password: string): Errors {
  const e: Errors = {};
  if (name.trim().length < 2) e.name = 'Please enter your name';
  if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email';
  if (password.length < 8) e.password = 'At least 8 characters';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Include a letter and a number';
  return e;
}

export default function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={postLoginPath(user, params.get('redirect'))} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateClient(name, email, password);
    setErrors(v);
    if (Object.keys(v).length) return;
    setLoading(true);
    try {
      const u = await register(name, email, password);
      toast.success('Account created — welcome to Bazaar!');
      navigate(postLoginPath(u, params.get('redirect')), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const fieldErrors: Errors = {};
        for (const d of err.details) fieldErrors[d.path.replace('body.', '') as keyof Errors] = d.message;
        setErrors(fieldErrors);
      } else setErrors({ form: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Shop from independent sellers — or open your own store."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.form && (
          <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errors.form}
          </div>
        )}
        <Input label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        />
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
