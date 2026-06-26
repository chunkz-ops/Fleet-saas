# FleetSync — Fleet Management SaaS

A multi-tenant fleet management platform built with Next.js 14 and Supabase.

## Features
- Vehicle management
- Driver management with photo uploads
- Trip logging with map
- Fuel log tracking
- Maintenance records
- Tire management
- GPS tracking (simulated)
- Alerts & notifications
- Analytics dashboard

---

## Deploy to Vercel

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase_schema.sql`
3. Go to **Storage** and create a public bucket named `driver-photos`
4. Go to **Settings > API** and copy your **Project URL** and **anon public** key

### 2. Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add these **Environment Variables** in Vercel:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

4. Click **Deploy**

### 3. Configure Supabase Auth (important!)

After deploying, go to your Supabase project:
- **Authentication > URL Configuration**
- Set **Site URL** to your Vercel URL (e.g. `https://your-app.vercel.app`)
- Add `https://your-app.vercel.app/**` to **Redirect URLs**

---

## Local Development

```bash
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local

npm install
npm run dev
```
