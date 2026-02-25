'use client';

import { useState } from 'react';
import { ScanCatalog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function CategoryManagement({
  categories,
  onCreate,
}: {
  categories: ScanCatalog[];
  onCreate: (name: string, initialPrice: number, effectiveStartDate: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Categories</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
        <Button onClick={async () => { if (!name.trim()) return; await onCreate(name.trim(), price, new Date().toISOString().slice(0,10)); setName(''); setPrice(0); }}>
          Add Category
        </Button>
      </div>
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="rounded border p-2 text-sm">
            {category.name}
          </div>
        ))}
      </div>
    </Card>
  );
}
