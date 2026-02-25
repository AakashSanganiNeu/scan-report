'use client';

import { useState } from 'react';
import { Hospital } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function HospitalManagement({
  hospitals,
  onCreate,
}: {
  hospitals: Hospital[];
  onCreate: (name: string, location?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Hospitals</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Hospital name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Button onClick={async () => { if (!name.trim()) return; await onCreate(name.trim(), location.trim() || undefined); setName(''); setLocation(''); }}>
          Add Hospital
        </Button>
      </div>
      <div className="space-y-2">
        {hospitals.map((hospital) => (
          <div key={hospital.id} className="rounded border p-2 text-sm flex items-center justify-between">
            <span>{hospital.name}</span>
            <span className="text-slate-500">{hospital.location || '—'}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
