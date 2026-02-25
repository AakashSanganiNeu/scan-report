'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/login`,
    });
    setMessage(error ? error.message : 'Password reset email sent.');
  };

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-slate-50">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Send reset link</Button>
        </form>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </Card>
    </main>
  );
}
