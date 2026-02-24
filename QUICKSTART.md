# Quick Start Guide

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Get Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy your project URL and anonymous key

### Step 3: Set Environment Variables
Create a `.env.local` file in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anonymous-key
```

### Step 4: Start Development Server
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

The database is automatically configured when you first access the application:

✓ Tables created with proper indexes
✓ Row Level Security (RLS) policies configured
✓ 11 ultrasound scan types pre-populated with pricing
✓ Sample data can be added via the form

## First Entry

1. Click on the date field to select today's date
2. Enter a quantity for any scan type (e.g., "2" for Abdomen Pelvis)
3. Watch the total revenue calculate automatically
4. Click "Save Entry"
5. View your entry in the table below

## Next Steps

- Explore the **Analytics** tab to see charts
- Try **exporting** data as CSV or PDF
- Navigate between months using the selector
- Edit entries by clicking the pencil icon
- Delete entries by clicking the trash icon

## Troubleshooting

**"Failed to load data"**
→ Check your environment variables are correct

**No scan types showing**
→ Database seed data may not have run - refresh the page

**Can't see entries after saving**
→ Make sure you're viewing the correct month

## Key Features

| Feature | Location |
|---------|----------|
| Add Daily Entries | Daily Entries Tab → Form |
| View All Entries | Daily Entries Tab → Table |
| Monthly Summary | Monthly Summary Tab |
| Charts & Analytics | Analytics Tab |
| Export Data | Top Right Button |
| Edit Entry | Pencil icon in table |
| Delete Entry | Trash icon in table |

## Support

For detailed documentation, see [README.md](./README.md)
