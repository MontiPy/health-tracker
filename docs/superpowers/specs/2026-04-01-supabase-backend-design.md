# Supabase Backend Design

**Date:** 2026-04-01  
**Project:** health-tracker  
**Status:** Approved

## Overview

Add a Supabase backend to the existing React + Vite health tracker. The app currently stores all data in localStorage. This design adds Google OAuth authentication and syncs user data to Supabase while keeping localStorage as a local cache (offline support preserved).

## Approach

**Thin sync layer (Option A):** All app logic continues reading/writing localStorage as today. A new sync module mirrors writes to Supabase and pulls on login. Auth state lives in a React context at the top of the app.

Conflict rule: On login, if Supabase has data it overwrites localStorage. If Supabase is empty and localStorage has data (first-time login), localStorage data is migrated up to Supabase.

## Database Schema

### `profiles` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Matches `auth.users.id` |
| `units` | `text` | `'metric'` or `'imperial'` |
| `sex` | `text` | `'male'` or `'female'` |
| `age` | `int4` | |
| `height_cm` | `float8` | |
| `initial_weight_kg` | `float8` | |
| `pal` | `float8` | Physical Activity Level |
| `initial_calories` | `int4` | |
| `goal_weight_kg` | `float8` | Nullable |
| `goal_days` | `int4` | Nullable |
| `activity_change_reach_pct` | `float8` | |
| `activity_change_maintain_pct` | `float8` | |
| `uncertainty_pct` | `float8` | |
| `energy_unit` | `text` | `'kcal'` or `'kj'` |
| `start_date` | `date` | ISO date string |
| `updated_at` | `timestamptz` | Set on every upsert |

RLS: `SELECT/INSERT/UPDATE/DELETE` gated on `auth.uid() = id`.

### `day_logs` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Default `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `day` | `int4` | Day number from start date |
| `weight_kg` | `float8` | |
| `calories` | `int4` | |
| `logged_at` | `timestamptz` | Default `now()` |

Unique constraint on `(user_id, day)` to support upserts.  
RLS: `SELECT/INSERT/UPDATE/DELETE` gated on `auth.uid() = user_id`.

## Architecture

### New files

- **`src/lib/supabase.ts`** — Already exists as stub. Update to read real env vars (no fallback strings).
- **`src/lib/sync.ts`** — Sync module:
  - `pushToSupabase(profile, logs, startDate, energyUnit)` — upserts profile row + batch upserts all day_logs
  - `pullFromSupabase()` → `{profile, logs, startDate, energyUnit} | null` — fetches user data, returns null if no data
- **`src/contexts/AuthContext.tsx`** — React context:
  - Exposes: `user`, `signInWithGoogle()`, `signOut()`, `isLoading`
  - On login: calls `pullFromSupabase()`; if data exists, writes to localStorage (Supabase wins); if no Supabase data, calls `pushToSupabase` with current localStorage contents
- **`src/components/AuthButton.tsx`** — Google Sign-In / Sign-Out button for the nav bar

### Modified files

- **`src/main.tsx`** — Wrap `<App>` in `<AuthProvider>`
- **`src/App.tsx`** — Import `AuthContext`; after every profile save and log save, fire-and-forget `pushToSupabase`; render `<AuthButton>` in nav

### Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Added to `.env.local` (gitignored). Supabase project is created via MCP tools.

## Auth Flow

1. User clicks "Sign in with Google" → Supabase OAuth redirect
2. On return, `onAuthStateChange` fires with session
3. `AuthContext` pulls data from Supabase
4. If Supabase has profile → overwrites localStorage (Supabase wins)
5. If Supabase is empty → pushes localStorage data to Supabase (first login migration)
6. App continues as normal; all future writes go to localStorage + fire-and-forget Supabase push

## Error Handling

- Supabase sync errors are caught and logged to console; they never block the UI
- If the user is not logged in, sync calls are skipped silently
- Auth state is persisted by Supabase client automatically (via localStorage session)

## Out of Scope

- Multi-device real-time sync (no subscriptions/channels)
- Social features, sharing
- Email/password auth (Google only)
- Data deletion UI (can be done via Supabase dashboard)
