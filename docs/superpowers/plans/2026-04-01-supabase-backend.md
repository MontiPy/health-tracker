# Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth + Supabase sync to the health tracker, keeping localStorage as local cache with Supabase as the remote source of truth.

**Architecture:** A thin sync layer (`src/lib/sync.ts`) mirrors localStorage writes to Supabase and pulls on login. An `AuthContext` wraps the app, triggers pull-on-login and first-login migration. All existing app logic is unchanged — sync calls are fire-and-forget.

**Tech Stack:** React 19, TypeScript, Vite, @supabase/supabase-js ^2, Supabase MCP tools for project/schema setup, Vitest for sync unit tests.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/supabase.ts` | Modify | Remove placeholder fallbacks, export typed client |
| `src/lib/sync.ts` | Create | `pushToSupabase` and `pullFromSupabase` functions |
| `src/contexts/AuthContext.tsx` | Create | Google OAuth state, login/logout, on-login sync trigger |
| `src/components/AuthButton.tsx` | Create | Sign-in/out button for the header |
| `src/main.tsx` | Modify | Wrap `<App>` with `<AuthProvider>` |
| `src/App.tsx` | Modify | Import auth context, fire-and-forget push after saves, render `<AuthButton>` |
| `.env.local` | Create | Real Supabase URL + anon key (gitignored) |
| `vite.config.ts` | Check/Modify | Add test config for Vitest if not present |
| `src/lib/sync.test.ts` | Create | Unit tests for sync serialisation helpers |

---

## Task 1: Create Supabase Project

**Files:**
- Create: `.env.local`

- [ ] **Step 1: List existing Supabase organizations**

Use the `mcp__supabase__list_organizations` tool (no params). Note the org ID for use in the next step.

- [ ] **Step 2: Create the project**

Use `mcp__supabase__create_project` with:
```json
{
  "name": "health-tracker",
  "organization_id": "<org_id_from_step_1>",
  "region": "us-east-1"
}
```
Wait for the project to finish provisioning (the tool will confirm). Note the project `id`.

- [ ] **Step 3: Get project URL and anon key**

Use `mcp__supabase__get_project_url` and `mcp__supabase__get_publishable_keys` with the project ID.

- [ ] **Step 4: Write .env.local**

```
VITE_SUPABASE_URL=<url from step 3>
VITE_SUPABASE_ANON_KEY=<anon key from step 3>
```

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore: document required env vars in .env.example"
```
Do NOT commit `.env.local` (it is already in `.gitignore`).

---

## Task 2: Apply Database Migrations

**Files:** (Supabase schema only — no local files changed)

- [ ] **Step 1: Create profiles table**

Use `mcp__supabase__apply_migration` with project ID and:
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  units text not null default 'imperial',
  sex text not null default 'male',
  age integer not null default 30,
  height_cm float8 not null default 170,
  initial_weight_kg float8 not null default 70,
  pal float8 not null default 1.5,
  initial_calories integer not null default 2000,
  goal_weight_kg float8,
  goal_days integer,
  activity_change_reach_pct float8 not null default 0,
  activity_change_maintain_pct float8 not null default 0,
  uncertainty_pct float8 not null default 5,
  energy_unit text not null default 'kcal',
  start_date date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can manage their own profile"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

Name the migration `create_profiles`.

- [ ] **Step 2: Create day_logs table**

Use `mcp__supabase__apply_migration` with:
```sql
create table public.day_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer not null,
  weight_kg float8 not null,
  calories integer not null,
  logged_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.day_logs enable row level security;

create policy "Users can manage their own logs"
  on public.day_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Name the migration `create_day_logs`.

- [ ] **Step 3: Verify migrations**

Use `mcp__supabase__list_migrations` to confirm both migrations are listed.

---

## Task 3: Enable Google OAuth in Supabase

**Files:** (Supabase dashboard config — no local files)

- [ ] **Step 1: Open Auth settings in Supabase dashboard**

Navigate to your Supabase project → Authentication → Providers → Google.

- [ ] **Step 2: Enable Google provider**

In the Supabase dashboard, enable Google OAuth. You will need a Google OAuth client ID and secret from Google Cloud Console (OAuth 2.0 credentials). Set the authorized redirect URI in Google Cloud Console to:
```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

- [ ] **Step 3: Confirm**

The Google provider should show as "Enabled" in the Supabase dashboard.

> Note: For local testing, also add `http://localhost:5173` as an authorized JavaScript origin and `http://localhost:5173` as a redirect URI in your Supabase project's Auth → URL Configuration → Site URL and Redirect URLs.

---

## Task 4: Update Supabase Client

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Read current file**

Read `src/lib/supabase.ts`. Current content:
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Replace with typed client (no fallback strings)**

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "chore: remove supabase client placeholder fallbacks"
```

---

## Task 5: Add Vitest and Write Sync Tests

**Files:**
- Modify: `vite.config.ts` (or `vitest.config.ts`)
- Create: `src/lib/sync.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest @vitest/ui
```

- [ ] **Step 2: Read vite.config.ts**

Read the current `vite.config.ts` to check its structure before modifying.

- [ ] **Step 3: Add test config to vite.config.ts**

Add a `test` block inside the existing `defineConfig`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
}
```
The full file should look like:
```ts
import { defineConfig } from 'vite'
// ... existing imports

export default defineConfig({
  // ... existing config
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write failing tests for sync serialisation**

Create `src/lib/sync.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { profileToRow, rowToProfile, logToRow, rowToLog } from './sync'
import type { UserProfile, DayLog } from '../models/hallModel'

const sampleProfile: UserProfile = {
  units: 'imperial',
  sex: 'male',
  age: 33,
  heightCm: 182.88,
  initialWeightKg: 90.72,
  pal: 1.5,
  initialCalories: 2700,
  goalWeightKg: 81.65,
  goalDays: 120,
  activityChangeReachPct: 0,
  activityChangeMaintainPct: 0,
  uncertaintyPct: 5,
}

describe('profileToRow / rowToProfile', () => {
  it('round-trips a full profile without loss', () => {
    const row = profileToRow(sampleProfile, '2026-01-01', 'kcal')
    const { profile, startDate, energyUnit } = rowToProfile(row)
    expect(profile).toEqual(sampleProfile)
    expect(startDate).toBe('2026-01-01')
    expect(energyUnit).toBe('kcal')
  })

  it('handles missing goal fields (null → undefined)', () => {
    const noGoal = { ...sampleProfile, goalWeightKg: undefined, goalDays: undefined }
    const row = profileToRow(noGoal, '2026-01-01', 'kcal')
    expect(row.goal_weight_kg).toBeNull()
    expect(row.goal_days).toBeNull()
    const { profile } = rowToProfile(row)
    expect(profile.goalWeightKg).toBeUndefined()
    expect(profile.goalDays).toBeUndefined()
  })
})

describe('logToRow / rowToLog', () => {
  it('round-trips a day log', () => {
    const log: DayLog = { day: 7, weightKg: 89.5, calories: 2100 }
    const row = logToRow(log, 'user-uuid-123')
    expect(row.day).toBe(7)
    expect(row.weight_kg).toBe(89.5)
    expect(row.calories).toBe(2100)
    expect(row.user_id).toBe('user-uuid-123')
    const restored = rowToLog(row)
    expect(restored).toEqual(log)
  })
})
```

- [ ] **Step 6: Run tests — expect failure (functions not yet defined)**

```bash
npm test
```
Expected: FAIL — "profileToRow is not a function" or similar import error.

- [ ] **Step 7: Commit test file**

```bash
git add src/lib/sync.test.ts vite.config.ts package.json package-lock.json
git commit -m "test: add sync serialisation unit tests (red)"
```

---

## Task 6: Create sync.ts

**Files:**
- Create: `src/lib/sync.ts`

- [ ] **Step 1: Create src/lib/sync.ts**

```ts
import { supabase } from './supabase'
import type { UserProfile, DayLog } from '../models/hallModel'

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface ProfileRow {
  id?: string
  units: string
  sex: string
  age: number
  height_cm: number
  initial_weight_kg: number
  pal: number
  initial_calories: number
  goal_weight_kg: number | null
  goal_days: number | null
  activity_change_reach_pct: number
  activity_change_maintain_pct: number
  uncertainty_pct: number
  energy_unit: string
  start_date: string
  updated_at?: string
}

export interface LogRow {
  id?: string
  user_id: string
  day: number
  weight_kg: number
  calories: number
  logged_at?: string
}

/* ── Serialisation helpers (exported for testing) ───────────────────────── */

export function profileToRow(
  profile: UserProfile,
  startDate: string,
  energyUnit: string,
): ProfileRow {
  return {
    units: profile.units,
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.heightCm,
    initial_weight_kg: profile.initialWeightKg,
    pal: profile.pal,
    initial_calories: profile.initialCalories,
    goal_weight_kg: profile.goalWeightKg ?? null,
    goal_days: profile.goalDays ?? null,
    activity_change_reach_pct: profile.activityChangeReachPct,
    activity_change_maintain_pct: profile.activityChangeMaintainPct,
    uncertainty_pct: profile.uncertaintyPct,
    energy_unit: energyUnit,
    start_date: startDate,
    updated_at: new Date().toISOString(),
  }
}

export function rowToProfile(row: ProfileRow): {
  profile: UserProfile
  startDate: string
  energyUnit: string
} {
  return {
    profile: {
      units: row.units as 'metric' | 'imperial',
      sex: row.sex as 'male' | 'female',
      age: row.age,
      heightCm: row.height_cm,
      initialWeightKg: row.initial_weight_kg,
      pal: row.pal,
      initialCalories: row.initial_calories,
      goalWeightKg: row.goal_weight_kg ?? undefined,
      goalDays: row.goal_days ?? undefined,
      activityChangeReachPct: row.activity_change_reach_pct,
      activityChangeMaintainPct: row.activity_change_maintain_pct,
      uncertaintyPct: row.uncertainty_pct,
    },
    startDate: row.start_date,
    energyUnit: row.energy_unit,
  }
}

export function logToRow(log: DayLog, userId: string): LogRow {
  return {
    user_id: userId,
    day: log.day,
    weight_kg: log.weightKg,
    calories: log.calories,
  }
}

export function rowToLog(row: LogRow): DayLog {
  return {
    day: row.day,
    weightKg: row.weight_kg,
    calories: row.calories,
  }
}

/* ── Push to Supabase ────────────────────────────────────────────────────── */

export async function pushToSupabase(
  userId: string,
  profile: UserProfile,
  logs: DayLog[],
  startDate: string,
  energyUnit: string,
): Promise<void> {
  const profileRow = { id: userId, ...profileToRow(profile, startDate, energyUnit) }

  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert(profileRow, { onConflict: 'id' })

  if (profileErr) {
    console.error('[sync] pushToSupabase profile error:', profileErr.message)
    return
  }

  if (logs.length === 0) return

  const logRows = logs.map(l => logToRow(l, userId))
  const { error: logsErr } = await supabase
    .from('day_logs')
    .upsert(logRows, { onConflict: 'user_id,day' })

  if (logsErr) {
    console.error('[sync] pushToSupabase logs error:', logsErr.message)
  }
}

/* ── Pull from Supabase ──────────────────────────────────────────────────── */

export async function pullFromSupabase(userId: string): Promise<{
  profile: UserProfile
  logs: DayLog[]
  startDate: string
  energyUnit: string
} | null> {
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileErr || !profileRow) return null

  const { profile, startDate, energyUnit } = rowToProfile(profileRow as ProfileRow)

  const { data: logRows, error: logsErr } = await supabase
    .from('day_logs')
    .select('*')
    .eq('user_id', userId)
    .order('day', { ascending: true })

  if (logsErr) {
    console.error('[sync] pullFromSupabase logs error:', logsErr.message)
    return { profile, logs: [], startDate, energyUnit }
  }

  const logs = (logRows as LogRow[]).map(rowToLog)
  return { profile, logs, startDate, energyUnit }
}
```

- [ ] **Step 2: Run tests — expect pass**

```bash
npm test
```
Expected: All 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat: add supabase sync module with push/pull and serialisation"
```

---

## Task 7: Create AuthContext

**Files:**
- Create: `src/contexts/AuthContext.tsx`

The storage keys to read from localStorage match `App.tsx`:
- `STORAGE_KEY_PROFILE = 'health_tracker_profile'`
- `STORAGE_KEY_LOGS = 'health_tracker_logs'`
- `STORAGE_KEY_START_DATE = 'health_tracker_start_date'`
- `STORAGE_KEY_ENERGY_UNIT = 'health_tracker_energy_unit'`

- [ ] **Step 1: Create src/contexts/AuthContext.tsx**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { pushToSupabase, pullFromSupabase } from '../lib/sync'
import type { UserProfile, DayLog } from '../models/hallModel'

const STORAGE_KEY_PROFILE    = 'health_tracker_profile'
const STORAGE_KEY_LOGS       = 'health_tracker_logs'
const STORAGE_KEY_START_DATE = 'health_tracker_start_date'
const STORAGE_KEY_ENERGY_UNIT = 'health_tracker_energy_unit'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialise from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser = session?.user ?? null
        setUser(nextUser)

        if (nextUser) {
          await handleLogin(nextUser.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin(userId: string) {
    const remote = await pullFromSupabase(userId)

    if (remote) {
      // Supabase has data → overwrite localStorage (Supabase wins)
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(remote.profile))
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(remote.logs))
      localStorage.setItem(STORAGE_KEY_START_DATE, remote.startDate)
      localStorage.setItem(STORAGE_KEY_ENERGY_UNIT, remote.energyUnit)
      // Force a page reload so App.tsx re-reads localStorage state
      window.location.reload()
    } else {
      // No remote data → migrate localStorage up to Supabase (first login)
      const profileStr  = localStorage.getItem(STORAGE_KEY_PROFILE)
      const logsStr     = localStorage.getItem(STORAGE_KEY_LOGS)
      const startDate   = localStorage.getItem(STORAGE_KEY_START_DATE)
      const energyUnit  = localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) ?? 'kcal'

      if (profileStr && startDate) {
        const profile: UserProfile = {
          units: 'metric',
          activityChangeReachPct: 0,
          activityChangeMaintainPct: 0,
          uncertaintyPct: 5,
          ...JSON.parse(profileStr),
        }
        const logs: DayLog[] = logsStr ? JSON.parse(logsStr) : []
        await pushToSupabase(userId, profile, logs, startDate, energyUnit)
      }
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: add AuthContext with Google OAuth and on-login sync"
```

---

## Task 8: Create AuthButton Component

**Files:**
- Create: `src/components/AuthButton.tsx`

- [ ] **Step 1: Create src/components/AuthButton.tsx**

```tsx
import { useAuth } from '../contexts/AuthContext'
import { LogIn, LogOut } from 'lucide-react'

export default function AuthButton() {
  const { user, isLoading, signInWithGoogle, signOut } = useAuth()

  if (isLoading) return null

  if (user) {
    return (
      <button
        onClick={signOut}
        title={`Signed in as ${user.email}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <LogOut size={12} />
        Sign Out
      </button>
    )
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-teal-600 text-white shadow-sm hover:bg-teal-700 transition-colors"
    >
      <LogIn size={12} />
      Sign In
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AuthButton.tsx
git commit -m "feat: add AuthButton component for Google sign-in/out"
```

---

## Task 9: Update main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Read current main.tsx**

Current content:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Wrap App with AuthProvider**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: wrap app with AuthProvider"
```

---

## Task 10: Update App.tsx — Add AuthButton and Fire-and-Forget Sync

**Files:**
- Modify: `src/App.tsx`

There are two changes:
1. Render `<AuthButton>` in the header (line ~459–478, the `<header>` block)
2. After each localStorage `useEffect` write, fire-and-forget `pushToSupabase`

- [ ] **Step 1: Read the top of App.tsx (lines 1–25)**

Identify the existing imports block.

- [ ] **Step 2: Add imports at the top of App.tsx**

After the last existing import line, add:
```tsx
import { useAuth } from './contexts/AuthContext';
import { pushToSupabase } from './lib/sync';
import AuthButton from './components/AuthButton';
```

- [ ] **Step 3: Read the persistence useEffects (lines 380–391)**

They currently look like:
```tsx
useEffect(() => {
  if (profile) localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
}, [profile]);

useEffect(() => {
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
}, [logs]);

useEffect(() => {
  localStorage.setItem(STORAGE_KEY_ENERGY_UNIT, energyUnit);
}, [energyUnit]);
```

- [ ] **Step 4: Add useAuth call inside the App function**

Directly after the line `function App() {`, add:
```tsx
const { user } = useAuth();
```

- [ ] **Step 5: Replace the three persistence useEffects with sync-aware versions**

```tsx
useEffect(() => {
  if (profile) {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    if (user) {
      const sd = localStorage.getItem(STORAGE_KEY_START_DATE) ?? startDate.toISOString().slice(0, 10);
      const eu = localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) ?? 'kcal';
      pushToSupabase(user.id, profile, logs, sd, eu).catch(console.error);
    }
  }
}, [profile]);  // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  if (user && profile) {
    const sd = localStorage.getItem(STORAGE_KEY_START_DATE) ?? startDate.toISOString().slice(0, 10);
    const eu = localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) ?? 'kcal';
    pushToSupabase(user.id, profile, logs, sd, eu).catch(console.error);
  }
}, [logs]);  // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  localStorage.setItem(STORAGE_KEY_ENERGY_UNIT, energyUnit);
}, [energyUnit]);
```

- [ ] **Step 6: Add AuthButton to the header**

Find the header closing area (around line 478, just before `</header>`). The header currently ends with:
```tsx
        )}
      </header>
```

Change it to:
```tsx
        )}
        <AuthButton />
      </header>
```

- [ ] **Step 7: Run the dev server to verify no TypeScript errors**

```bash
npm run build 2>&1 | head -40
```
Expected: Build completes with no errors. Warnings about exhaustive-deps are acceptable.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up supabase sync and auth button in App"
```

---

## Task 11: Verify End-to-End

- [ ] **Step 1: Run tests**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Smoke test in browser**

Open `http://localhost:5173`. Verify:
1. "Sign In" button appears in the header
2. Clicking "Sign In" initiates Google OAuth redirect
3. After login, if no remote data exists, existing localStorage data is preserved
4. Sign-out clears the session (button switches back to "Sign In")

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: supabase backend with google auth and localStorage sync"
```
