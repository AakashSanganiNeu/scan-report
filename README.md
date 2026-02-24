# Ultrasound Scan Revenue Calculator

A modern, responsive web application for diagnostic centers to track daily ultrasound scan counts and calculate revenue. Built with Next.js, React, TypeScript, Tailwind CSS, and Supabase.

## Features

### Core Functionality
- **Daily Entry Form**: Enter ultrasound scan quantities for each scan type with automatic price calculation
- **Real-time Calculations**: Automatic calculation of daily totals and monthly summaries
- **Monthly Dashboard**: Summary statistics including total scans, revenue, and average revenue per day
- **Edit/Delete**: Update or remove daily entries with confirmation dialogs
- **Data Persistence**: All data stored in Supabase PostgreSQL database

### Analytics & Reporting
- **Revenue Trend Chart**: Line chart showing daily revenue trends throughout the month
- **Scan Type Analysis**: Bar chart showing top scan types by revenue
- **Daily Scan Count**: Visual representation of daily scan volumes
- **Monthly Summary Table**: Scan-wise breakdown with quantities and revenue

### Export & Reports
- **CSV Export**: Download daily entries and monthly summaries as CSV files
- **Print Report**: A4-friendly HTML report with full month summary and daily breakdown
- **Professional Layout**: Clean, printable report design

### User Experience
- **Multi-device Support**: Responsive design for desktop, tablet, and mobile
- **Month Navigation**: Easy navigation between months with date selector
- **Loading States**: Skeleton loaders and empty states for better UX
- **Toast Notifications**: Feedback for all actions (save, update, delete, export)
- **Professional UI**: Clean healthcare admin dashboard aesthetic with blue/teal palette

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts for data visualization
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Database Schema

### Tables

#### `scan_catalog`
Fixed list of ultrasound scan types with pricing
- `id` (UUID, PK)
- `name` (TEXT, UNIQUE)
- `price` (NUMERIC)
- `modality` (TEXT, default: 'Ultrasound')
- `is_active` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

#### `daily_entries`
Daily aggregated scan and revenue data
- `id` (UUID, PK)
- `entry_date` (DATE, UNIQUE)
- `notes` (TEXT, nullable)
- `total_scans` (INTEGER)
- `total_revenue` (NUMERIC)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `daily_entry_items`
Individual scan line items for each day
- `id` (UUID, PK)
- `daily_entry_id` (UUID, FK → daily_entries)
- `scan_catalog_id` (UUID, FK → scan_catalog)
- `quantity` (INTEGER)
- `unit_price` (NUMERIC)
- `line_total` (NUMERIC)
- `created_at` (TIMESTAMPTZ)

## Ultrasound Scan Types

The application comes pre-populated with 11 ultrasound scan types:

1. **Abdomen Pelvis** - ₹1,200
2. **TVS** - ₹1,200
3. **Growth Scan** - ₹1,000
4. **Obs Doppler** - ₹2,000
5. **Obs BPP** - ₹2,000
6. **Color Doppler (1 leg arterial/venous)** - ₹4,000
7. **TIFFA** - ₹2,500
8. **NT Scan** - ₹1,800
9. **Early Pregnancy** - ₹1,000
10. **Small Parts (Swelling)** - ₹1,500
11. **Follicular Study (3 visits)** - ₹1,800

## Getting Started

### Prerequisites
- Node.js 18+ (pnpm is the default package manager)
- Supabase account and project

### Installation

1. **Clone or Download** the project
2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Add these to your `.env.local` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**:
   - The database tables are created via migrations that run automatically
   - The scan catalog is pre-populated with the 11 ultrasound scan types

5. **Run Development Server**:
   ```bash
   pnpm dev
   ```

6. **Access the Application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Adding an Entry
1. Navigate to the "Daily Entries" tab
2. Select a date using the date picker
3. Enter quantities for each scan type
4. Totals are calculated automatically
5. Add optional notes
6. Click "Save Entry"

### Viewing Data
- **Daily Entries Tab**: View all entries for the selected month in a table
- **Monthly Summary Tab**: See aggregate statistics and scan-wise breakdown
- **Analytics Tab**: View revenue trends, scan distribution, and daily volumes

### Editing/Deleting
- Click the pencil icon to edit an entry (form will populate with existing data)
- Click the trash icon to delete (confirmation required)
- Use the "View" eye icon to see detailed breakdown without editing

### Exporting Data
1. Click the "Export" button in the top right
2. Choose from:
   - **Daily Entries (CSV)**: All daily entries in spreadsheet format
   - **Monthly Summary (CSV)**: Scan-wise monthly totals
   - **Print Report (A4)**: Print-friendly HTML report

### Navigation
- Use the month selector to view different months
- Use arrow buttons for quick month navigation
- Select any month from the dropdown (2-year range)

## Component Structure

```
app/
├── page.tsx                          # Main dashboard
lib/
├── actions.ts                        # Server actions (CRUD)
├── types.ts                          # TypeScript types
├── supabase/
│   ├── client.ts                    # Browser Supabase client
│   └── server.ts                    # Server Supabase client
└── utils/
    └── formatting.ts                 # Formatting, export utilities
components/
├── daily-entry-form.tsx             # Daily entry form
├── daily-entries-table.tsx          # Daily entries table
├── monthly-summary-table.tsx        # Monthly summary table
├── stat-card.tsx                    # Summary stat card
├── charts.tsx                       # Chart components
├── export-menu.tsx                  # Export functionality
└── ui/                              # shadcn/ui components
scripts/
├── 001_create_tables.sql            # Database schema
└── 002_seed_scan_catalog.sql        # Scan catalog seed data
```

## Data Flow

1. **Form Submission** → Server Action
2. **Validation** → Zod schema validation
3. **Database** → Insert/Update daily_entries and daily_entry_items
4. **Auto-calculation** → Total scans and revenue computed
5. **Reload** → Fresh data fetched and UI updated
6. **Toast** → User feedback notification

## Security & Privacy

- **Row Level Security (RLS)**: All tables have public read/write policies (suitable for internal use)
- **For Production**: Implement authentication and user-specific RLS policies
- **No Authentication**: Currently no login required (internal diagnostic center use case)
- **Input Validation**: All inputs validated with Zod schemas
- **SQL Injection Protection**: Parameterized queries via Supabase client

## Extensibility

### Adding More Modalities
The system is designed to support multiple imaging modalities (X-ray, CT, MRI, etc.):

1. Update `scan_catalog` table with new scan types
2. Add `modality` filter in queries
3. Create separate daily_entries per modality or add modality column
4. Add modality selector to the form

### Customization Options
- **Colors**: Edit Tailwind classes in components for theme changes
- **Scan Types**: Add/remove from `scan_catalog` table in database
- **Pricing**: Update prices in `scan_catalog` table
- **Fields**: Add columns to `daily_entries` (e.g., radiologist name, department)

## Troubleshooting

### Database Connection Error
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
- Check that your Supabase project is active

### Tables Not Found
- Ensure database migrations have been run
- The migration files create all necessary tables

### Data Not Showing
- Check that your month selection matches the data entry date
- Verify RLS policies allow read access
- Check browser console for errors

## Future Enhancements

- User authentication with role-based access
- Multi-user support with user-specific data
- More modalities (X-ray, CT, MRI, Ultrasound video reports)
- Radiologist assignment and tracking
- Revenue split/commission calculations
- Advanced reporting and analytics
- Machine learning for predictive analytics
- Mobile app (React Native)

## Support & Feedback

For issues or feature requests, please refer to the development guidelines or contact the development team.

## License

This project is proprietary software for diagnostic center management.
