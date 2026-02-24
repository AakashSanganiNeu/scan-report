# Developer Quick Reference

## Essential Commands

```bash
# Setup
pnpm install                  # Install dependencies
pnpm dev                      # Start dev server
pnpm build                    # Build for production
pnpm start                    # Start production server

# Database
# (Migrations run automatically from scripts/ folder)
```

## File Locations

| Task | File |
|------|------|
| Add/edit page | `app/page.tsx` |
| New component | `components/[name].tsx` |
| Server logic | `lib/actions.ts` |
| Types | `lib/types.ts` |
| Database setup | `scripts/*.sql` |
| Utilities | `lib/utils/formatting.ts` |

## Common Tasks

### Add New Scan Type
```sql
-- In Supabase SQL Editor
INSERT INTO scan_catalog (name, price, modality, is_active) 
VALUES ('New Scan', 3000, 'Ultrasound', true);
```

### Fetch Data in Component
```typescript
'use server';
import { fetchScanCatalog } from '@/lib/actions';

const scans = await fetchScanCatalog();
```

### Create New Server Action
```typescript
// In lib/actions.ts
'use server';

export async function myAction(param: string) {
  const supabase = await createClient();
  // your logic
}
```

### Add New UI Component
```typescript
// components/my-component.tsx
'use client'; // if using hooks

import { Card } from '@/components/ui/card';

export function MyComponent() {
  return (
    <Card className="p-6">
      {/* content */}
    </Card>
  );
}
```

### Format Currency
```typescript
import { formatCurrency } from '@/lib/utils/formatting';

const price = formatCurrency(5000); // "₹5,000"
```

### Date Handling
```typescript
import { formatDate, toInputDateFormat, parseDate } from '@/lib/utils/formatting';

const formatted = formatDate('2024-01-15');    // "15 Jan 2024"
const inputFormat = toInputDateFormat(new Date()); // "2024-01-15"
const parsed = parseDate('2024-01-15');        // Date object
```

### Form Validation
```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const schema = z.object({
  quantity: z.number().min(0),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

## Database Schema Quick Reference

### Get All Entries for Month
```sql
SELECT * FROM daily_entries 
WHERE entry_date >= '2024-01-01' AND entry_date <= '2024-01-31'
ORDER BY entry_date DESC;
```

### Get Monthly Summary
```sql
SELECT 
  scan_catalog.name,
  SUM(daily_entry_items.quantity) as qty,
  SUM(daily_entry_items.line_total) as revenue
FROM daily_entry_items
JOIN daily_entries ON daily_entry_items.daily_entry_id = daily_entries.id
JOIN scan_catalog ON daily_entry_items.scan_catalog_id = scan_catalog.id
WHERE date_trunc('month', daily_entries.entry_date) = '2024-01-01'
GROUP BY scan_catalog.id, scan_catalog.name
ORDER BY revenue DESC;
```

## Component Props Cheat Sheet

### DailyEntryForm
```typescript
<DailyEntryForm
  scanCatalog={scans}           // ScanType[]
  onSubmit={handleSubmit}       // (data) => Promise<void>
  isLoading={false}             // boolean
  initialData={data}            // DailyEntryFormData (optional)
  isEditing={false}             // boolean
/>
```

### DailyEntriesTable
```typescript
<DailyEntriesTable
  entries={entries}             // DailyEntryWithItems[]
  onEdit={handleEdit}           // (entry) => void
  onDelete={handleDelete}       // (id) => Promise<void>
  isDeleting={false}            // boolean
/>
```

### StatCard
```typescript
<StatCard
  label="Total Revenue"         // string
  value={50000}                 // string | number
  currency={true}               // boolean (adds INR formatting)
  loading={false}               // boolean
/>
```

### Charts
```typescript
<RevenueChart data={dailyStats} isLoading={false} />
<ScanTypeChart summary={summary} isLoading={false} />
<ScansPerDayChart data={dailyStats} isLoading={false} />
```

## API Response Types

### Save Entry Response
```typescript
// Returns: DailyEntry
{
  id: "uuid",
  entry_date: "2024-01-15",
  notes: "some notes",
  total_scans: 10,
  total_revenue: 25000,
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z"
}
```

### Fetch Month Data Response
```typescript
// Returns: DailyEntryWithItems[]
[
  {
    id: "uuid",
    entry_date: "2024-01-15",
    total_scans: 10,
    total_revenue: 25000,
    items: [
      {
        id: "uuid",
        scan_catalog_id: "uuid",
        scan_name: "Abdomen Pelvis",
        quantity: 5,
        unit_price: 1200,
        line_total: 6000
      }
    ]
  }
]
```

## Debugging Tips

### Check Database
```sql
-- View all daily entries
SELECT * FROM daily_entries ORDER BY entry_date DESC LIMIT 10;

-- View items for a specific entry
SELECT * FROM daily_entry_items WHERE daily_entry_id = 'uuid';

-- Check scan catalog
SELECT * FROM scan_catalog;
```

### Check Server Action Logs
```typescript
// Add in lib/actions.ts
console.error('Debug info:', { param, result });
```

### Check Supabase Errors
```typescript
if (error) {
  console.error('Supabase error:', {
    message: error.message,
    code: error.code,
    details: error.details,
  });
  throw error;
}
```

## Styling Guide

### Tailwind Classes Used
```
Colors:     blue-50, blue-100, blue-600, blue-900, green-600, etc.
Spacing:    p-4, m-2, gap-4, px-6, py-8
Typography: text-sm, font-bold, font-medium
Layout:     flex, grid, grid-cols-2, gap-4, items-center
Hover:      hover:bg-blue-50, hover:text-blue-700
States:     disabled:opacity-50, focus:ring-2
```

### Custom Colors (defined in globals.css)
- Primary: Blue (#1e40af)
- Secondary: Teal/Cyan (#06b6d4)
- Success: Green (#16a34a)
- Neutral: Gray (#6b7280)

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "NEXT_PUBLIC_SUPABASE_URL not found" | Check `.env.local` file |
| "Cannot read property 'id' of null" | Table might not exist - check migrations |
| "RLS policy violation" | Check Supabase RLS policies |
| "Duplicate key value violates unique constraint" | Entry already exists for that date |
| "Chart not rendering" | Check data format matches expected structure |

## Performance Optimization

### Already Implemented
- ✓ Database indexes on commonly filtered columns
- ✓ Server-side data fetching (no over-fetching)
- ✓ Efficient Recharts implementation
- ✓ Memoized components (where needed)

### Consider Adding
- [ ] SWR for client-side caching
- [ ] Image optimization (Vercel Image)
- [ ] Code splitting/lazy loading
- [ ] Database connection pooling

## Testing Checklist

```typescript
// Test entry creation
await saveDailyEntry({
  entry_date: '2024-01-15',
  notes: 'test',
  items: [{ scan_catalog_id: 'id', quantity: 5 }]
});

// Test calculations
const total = items.reduce((sum, item) => sum + item.line_total, 0);
assert(total === expectedTotal);

// Test month filtering
const entries = await fetchDailyEntriesForMonth(2024, 1);
assert(entries.every(e => e.entry_date.startsWith('2024-01')));
```

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Zod](https://zod.dev)
- [React Hook Form](https://react-hook-form.com)
- [Recharts](https://recharts.org)

## Quick Deploy Checklist

- [ ] Update `.env.local` with production Supabase keys
- [ ] Run `pnpm build` to check for errors
- [ ] Test all CRUD operations
- [ ] Test export/print on production
- [ ] Verify database backups
- [ ] Set up monitoring
- [ ] Update documentation links if needed
- [ ] Test on mobile devices
