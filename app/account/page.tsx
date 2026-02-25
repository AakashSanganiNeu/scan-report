'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccountOverview } from '@/lib/actions';
import { AccountOverview } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function AccountPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<AccountOverview | null>(null);

  useEffect(() => {
    getAccountOverview().then(setOverview);
  }, []);

  const logout = async () => {
    await createClient().auth.signOut();
    router.replace('/auth/login');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Account & Billing</h1>
        <Card className="p-4 space-y-2">
          <p><span className="text-slate-500">Email:</span> {overview?.user_email}</p>
          <p><span className="text-slate-500">Status:</span> {overview?.subscription?.subscription_status || 'N/A'}</p>
          <p><span className="text-slate-500">Plan:</span> {overview?.subscription?.plan_name || 'Trial'}</p>
          <p><span className="text-slate-500">Days remaining:</span> {overview?.days_remaining ?? 0}</p>
          <p><span className="text-slate-500">Hospitals:</span> {overview?.hospitals_count ?? 0}</p>
          <p><span className="text-slate-500">Categories:</span> {overview?.categories_count ?? 0}</p>
          <div className="flex gap-2 pt-2">
            <Button className="bg-teal-600 hover:bg-teal-700">Upgrade (₹3000 / 6 months)</Button>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
