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
