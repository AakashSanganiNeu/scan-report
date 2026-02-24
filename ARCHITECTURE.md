# Architecture & Configuration

## Project Structure

```
project/
├── app/
│   ├── layout.tsx                  # Root layout with Supabase auth provider
│   └── page.tsx                    # Main dashboard
│
├── components/
│   ├── ui/                         # shadcn/ui components (auto-generated)
│   ├── daily-entry-form.tsx        # Form for adding/editing entries
│   ├── daily-entries-table.tsx     # Table displaying all daily entries
│   ├── monthly-summary-table.tsx   # Aggregated monthly data table
│   ├── stat-card.tsx               # Summary statistics card
│   ├── charts.tsx                  # Revenue, scan count, and type charts
│   └── export-menu.tsx             # CSV export and print functionality
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client singleton
│   │   └── server.ts               # Server client singleton
│   ├── actions.ts                  # Server actions for all CRUD ops
│   ├── types.ts                    # TypeScript type definitions
│   └── utils/
│       └── formatting.ts           # Formatting, export, and print utilities
│
├── scripts/
│   ├── 001_create_tables.sql       # Database schema migration
│   └── 002_seed_scan_catalog.sql   # Ultrasound scan types seed
│
├── public/                         # Static assets
├── .env.local                      # Environment variables (local)
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── tailwind.config.ts              # Tailwind CSS config
├── next.config.mjs                 # Next.js config
├── README.md                       # Full documentation
├── QUICKSTART.md                   # Quick setup guide
└── ARCHITECTURE.md                 # This file
```

## Data Flow Diagram

```
User Action (Form Submit)
        ↓
React Form (React Hook Form + Zod)
        ↓
Validation (Zod Schema)
        ↓
Server Action (lib/actions.ts)
        ↓
Supabase Client (lib/supabase/server.ts)
        ↓
PostgreSQL Database
        ↓
Server Action Returns Data
        ↓
Component Updates State
        ↓
UI Re-renders with new data
        ↓
Toast Notification
```

## Server Actions

All database operations are handled by server actions in `lib/actions.ts`:

### Read Operations
- `fetchScanCatalog()` - Get all active scan types
- `fetchDailyEntry(date)` - Get a single day's entries with items
- `fetchDailyEntriesForMonth(year, month)` - Get all entries for a month
- `getMonthlyStats(year, month)` - Calculate monthly aggregates
- `getDailyStats(year, month)` - Get daily revenue/scan trends

### Write Operations
- `saveDailyEntry(formData)` - Create or update an entry (upsert logic)
- `deleteDailyEntry(entryId)` - Delete an entry (cascades to items)

### Upsert Logic
```typescript
// If entry exists for date:
//   1. Update daily_entries totals
//   2. Delete old daily_entry_items
//   3. Insert new daily_entry_items
//
// If entry doesn't exist:
//   1. Create daily_entries row
//   2. Create daily_entry_items rows
```

## Type System

### Core Types
```typescript
// Scan catalog (read-only from database)
type ScanType = {
  id: string;
  name: string;
  price: number;
  modality: string;
  is_active: boolean;
  created_at: string;
};

// Daily entry aggregate
type DailyEntry = {
  id: string;
  entry_date: string;        // YYYY-MM-DD
  notes: string | null;
  total_scans: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
};

// Line item for daily entry
type DailyEntryItem = {
  id: string;
  daily_entry_id: string;
  scan_catalog_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

// Form submission data
type DailyEntryFormData = {
  entry_date: string;
  notes: string;
  items: Array<{
    scan_catalog_id: string;
    quantity: number;
  }>;
};

// Monthly summary
type MonthlySummary = {
  month: string;                    // YYYY-MM
  total_days: number;
  total_scans: number;
  total_revenue: number;
  average_revenue_per_day: number;
  items: Array<{
    scan_catalog_id: string;
    scan_name: string;
    unit_price: number;
    total_quantity: number;
    total_revenue: number;
  }>;
  highest_revenue_day?: {
    date: string;
    revenue: number;
  };
};
```

## Form Validation Schema

```typescript
const dailyEntrySchema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  notes: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        scan_catalog_id: z.string(),
        quantity: z.number().min(0, 'Quantity cannot be negative'),
      })
    )
    .refine((items) => items.some((item) => item.quantity > 0), {
      message: 'At least one scan must have quantity > 0',
    }),
});
```

## Database Schema

### scan_catalog
```sql
CREATE TABLE scan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  modality TEXT DEFAULT 'Ultrasound',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### daily_entries
```sql
CREATE TABLE daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE UNIQUE NOT NULL,
  notes TEXT,
  total_scans INTEGER NOT NULL DEFAULT 0 CHECK (total_scans >= 0),
  total_revenue NUMERIC NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### daily_entry_items
```sql
CREATE TABLE daily_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_entry_id UUID NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  scan_catalog_id UUID NOT NULL REFERENCES scan_catalog(id),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(daily_entry_id, scan_catalog_id)
);
```

## Key Design Decisions

1. **Upsert Pattern**: Update if exists, create if not - prevents duplicate dates
2. **Denormalized Totals**: Store total_scans and total_revenue in daily_entries for fast queries
3. **Line Items Table**: Separate table for flexibility and future features
4. **Server Actions**: Type-safe data mutations with automatic re-validation
5. **Zod Validation**: Both client and server-side validation for security
6. **CSV Export**: Client-side generation for privacy (no server files)
7. **Print Report**: Dynamic HTML generation for browser printing

## Performance Optimizations

1. **Indexes**: Created on commonly filtered columns (entry_date, daily_entry_id)
2. **Pagination**: Not yet implemented but ready for future scaling
3. **Caching**: Could add SWR for client-side data freshness
4. **Query Optimization**: Single queries per operation, minimal round trips
5. **CSV Generation**: Streamed to client without storing on server

## Security Considerations

1. **RLS Policies**: Currently public read/write (internal use only)
2. **For Production**: Implement user authentication and user-scoped RLS
3. **Input Validation**: Zod schemas prevent invalid data
4. **SQL Injection**: Supabase client prevents via parameterized queries
5. **Date Handling**: All dates in YYYY-MM-DD format (ISO standard)

## Extending the Application

### Adding a New Modality

1. **Update Schema**:
   ```sql
   -- Add modality column if not scanning by type
   ALTER TABLE daily_entries ADD COLUMN modality TEXT DEFAULT 'Ultrasound';
   ```

2. **Seed Data**:
   ```sql
   INSERT INTO scan_catalog (name, price, modality) VALUES
     ('X-ray Chest', 500, 'XRay'),
     ('CT Head', 5000, 'CT');
   ```

3. **Update Form**:
   ```tsx
   // Add modality selector
   <Select value={selectedModality} onValueChange={setSelectedModality}>
     <SelectItem value="Ultrasound">Ultrasound</SelectItem>
     <SelectItem value="XRay">X-Ray</SelectItem>
     <SelectItem value="CT">CT Scan</SelectItem>
   </Select>
   ```

4. **Filter Queries**:
   ```typescript
   .eq('modality', selectedModality)
   ```

### Adding User Authentication

1. Setup Supabase Auth in middleware.ts
2. Add RLS policies tied to auth.uid()
3. Add user_id column to daily_entries
4. Filter queries by user_id

### Adding Reports Dashboard

1. Create `/app/reports` page
2. Query aggregates across multiple months
3. Add Department-wise summaries
4. Create visualization dashboards

## Testing Checklist

- [ ] Add entry for current date
- [ ] Edit existing entry
- [ ] Delete entry with confirmation
- [ ] View entry details
- [ ] Navigate between months
- [ ] Export to CSV (daily and summary)
- [ ] Print report
- [ ] Verify calculations are correct
- [ ] Test on mobile device
- [ ] Test empty state
- [ ] Test form validation

## Environment Variables

```bash
# Required for Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anonymous-key

# Optional for future features
# NEXT_PUBLIC_API_ENDPOINT=...
```

## Deployment Checklist

- [ ] Update environment variables in Vercel
- [ ] Run database migrations on production
- [ ] Seed production scan catalog
- [ ] Test all CRUD operations
- [ ] Verify export functionality
- [ ] Test on mobile
- [ ] Set up monitoring/logging
- [ ] Configure backups
- [ ] Review RLS policies for production
- [ ] Implement user authentication
