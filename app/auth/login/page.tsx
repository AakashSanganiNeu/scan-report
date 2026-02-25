'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-slate-50">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Login</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</Button>
        </form>
        <div className="text-sm text-slate-600 flex justify-between">
          <Link href="/auth/signup" className="text-indigo-600">Create account</Link>
          <Link href="/auth/reset-password" className="text-indigo-600">Forgot password?</Link>
        </div>
      </Card>
    </main>
  );
}
