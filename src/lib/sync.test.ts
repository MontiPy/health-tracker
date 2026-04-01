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
