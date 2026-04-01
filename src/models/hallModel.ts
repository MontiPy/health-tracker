/**
 * Hall Lancet Dynamic Body Weight Model
 * Based on Hall et al. (2011) "Quantification of the effect of energy imbalance on bodyweight"
 */

export interface UserProfile {
  units: 'metric' | 'imperial';
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  initialWeightKg: number;
  pal: number; // Physical Activity Level
  initialCalories: number; // Maintenance calories
  goalWeightKg?: number;
  goalDays?: number;
  activityChangeReachPct: number;
  activityChangeMaintainPct: number;
  uncertaintyPct: number;
}

export const KG_TO_LB = 2.20462;
export const LB_TO_KG = 1 / KG_TO_LB;
export const CM_TO_IN = 0.393701;
export const IN_TO_CM = 1 / CM_TO_IN;

export function toDisplayWeight(kg: number, units: 'metric' | 'imperial'): number {
  return units === 'metric' ? kg : kg * KG_TO_LB;
}

export function fromDisplayWeight(val: number, units: 'metric' | 'imperial'): number {
  return units === 'metric' ? val : val * LB_TO_KG;
}

export interface DayLog {
  day: number;
  weightKg: number;
  calories: number;
}

export interface ModelResult {
  day: number;
  predictedWeightKg: number;
  lowEstWeightKg: number;
  highEstWeightKg: number;
  fatMassKg: number;
  leanMassKg: number;
  bmi: number;
  bodyFatPct: number;
}

// Constants from Kevin Hall's papers
const RHO_G = 17.6; // MJ/kg
const RHO_F = 39.5; // MJ/kg
const RHO_L = 7.6; // MJ/kg
const GAMMA_F = 0.013; // MJ/kg/d
const GAMMA_L = 0.092; // MJ/kg/d
const ETA_F = 0.75; // MJ/kg
const ETA_L = 0.96; // MJ/kg
const BETA_TEF = 0.1; // Hall 2011 Lancet: "βTEF = 0.1 represents the typical assumption of ~10% TEF"
// βAT = 0.14 in Hall 2011 Lancet (calibrated from semistarvation/aggressive restriction data).
// Post-2011 literature (CALERIE, Martins 2020, Nunes 2022 systematic review) shows that for
// typical lifestyle caloric restriction (~25% deficit), adaptive thermogenesis is smaller —
// βAT ≈ 0.05–0.07 fits moderate restriction studies and matches NIH BWP output.
const BETA_AT = 0.05;
const TAU_AT = 14; 
const NA_CONC = 3.22; // mg/ml
const XI_NA = 3000; // mg/L/d
const XI_CI = 4000; // mg/d

const MJ_TO_KCAL = 239.006; 
const KCAL_TO_MJ = 1 / MJ_TO_KCAL;

export function estimateInitialFatMass(p: UserProfile): number {
  const hMeters = p.heightCm / 100;
  const bmi = p.initialWeightKg / (hMeters * hMeters);
  if (p.sex === 'male') {
    return (p.initialWeightKg / 100) * (0.14 * p.age + 37.31 * Math.log(bmi) - 103.94);
  } else {
    return (p.initialWeightKg / 100) * (0.14 * p.age + 39.96 * Math.log(bmi) - 102.01);
  }
}

export function estimateInitialECF(p: UserProfile): number {
  if (p.sex === 'male') {
    return -12.424 + 0.191 * p.initialWeightKg + 0.0957 * p.heightCm + 0.025 * p.age;
  } else {
    return -4.027 + 0.167 * p.initialWeightKg + 0.05987 * p.heightCm;
  }
}

/**
 * Resting Metabolic Rate using Mifflin-St Jeor.
 * Hall 2011 Lancet appendix explicitly specifies this formula (reference 16).
 * Returns kcal/day.
 */
export function calculateRMR(p: UserProfile, weightKg?: number): number {
  const w = weightKg ?? p.initialWeightKg;
  if (p.sex === 'male') {
    return 10 * w + 6.25 * p.heightCm - 5 * p.age + 5;
  } else {
    return 10 * w + 6.25 * p.heightCm - 5 * p.age - 161;
  }
}

export function calculateMaintenanceCalories(p: UserProfile, weightKg: number): number {
  return calculateRMR(p, weightKg) * p.pal;
}

export function solveForGoalCalories(p: UserProfile, targetWeightKg: number, targetDays: number): number {
  let low = 500;
  let high = 5000;
  let bestEI = 2000;

  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const results = simulate(p, [], targetDays, mid);
    const finalWeight = results[results.length - 1].predictedWeightKg;
    if (finalWeight > targetWeightKg) {
      high = mid;
    } else {
      low = mid;
    }
    bestEI = mid;
  }
  return bestEI;
}

export function simulate(profile: UserProfile, logs: DayLog[], totalDays: number, constantEI?: number): ModelResult[] {
  let F = estimateInitialFatMass(profile);
  let ECF = estimateInitialECF(profile);
  const G_init = 0.5;
  let G = G_init;
  let L = profile.initialWeightKg - F - ECF - 3.7 * G;
  let AT = 0; 
  
  const hMeters = profile.heightCm / 100;
  const EI_maint_kcal = calculateMaintenanceCalories(profile, profile.initialWeightKg);
  const EI_baseline = EI_maint_kcal * KCAL_TO_MJ;
  const RMR_init = calculateRMR(profile) * KCAL_TO_MJ;
  
  const delta_init = ((1 - BETA_TEF) * profile.pal - 1) * RMR_init / profile.initialWeightKg;
  const K = EI_baseline - (GAMMA_F * F + GAMMA_L * L + delta_init * profile.initialWeightKg + BETA_TEF * EI_baseline);
  
  const results: ModelResult[] = [];
  
  for (let day = 0; day <= totalDays; day++) {
    const currentWeight = F + L + ECF + 3.7 * G;
    const inMaintainPhase = !!profile.goalDays && day >= profile.goalDays;
    const palChangePct = inMaintainPhase
      ? profile.activityChangeMaintainPct
      : profile.activityChangeReachPct;
    const currentPal = profile.pal * (1 + palChangePct / 100);
    const currentDelta = ((1 - BETA_TEF) * currentPal - 1) * RMR_init / profile.initialWeightKg;

    const uncertainty = (profile.uncertaintyPct || 5) / 100;
    // Band grows proportionally with sqrt of time elapsed (random-walk energy intake model)
    const bandScale = Math.sqrt(day / Math.max(1, totalDays));
    results.push({
      day,
      predictedWeightKg: currentWeight,
      lowEstWeightKg: currentWeight * (1 - uncertainty * bandScale),
      highEstWeightKg: currentWeight * (1 + uncertainty * bandScale),
      fatMassKg: F,
      leanMassKg: L,
      bmi: currentWeight / (hMeters * hMeters),
      bodyFatPct: (F / currentWeight) * 100
    });
    
    const log = logs.find(l => l.day === day);
    const dailyKcal = constantEI !== undefined ? constantEI : (log ? log.calories : EI_maint_kcal);
    const EI = dailyKcal * KCAL_TO_MJ;
    
    // ODE System
    const dG_dt = (0.5 * EI - (0.5 * EI_baseline / (G_init * G_init)) * G * G) / RHO_G;
    const dECF_dt = (-XI_NA * (ECF - estimateInitialECF(profile)) - XI_CI * (1 - (0.5 * EI) / (0.5 * EI_baseline))) / NA_CONC / 1000;

    // Phase-dependent adaptive thermogenesis (Martins et al. 2020: AT is present during
    // negative energy balance but decays when energy balance is restored at maintenance).
    // During reach phase: βAT = 0.05 (calibrated to moderate restriction literature).
    // During maintain phase: βAT = 0, so AT exponentially decays to 0 with τAT = 14 days.
    const effectiveBetaAT = inMaintainPhase ? 0 : BETA_AT;
    const dAT_dt = (effectiveBetaAT * (EI - EI_baseline) - AT) / TAU_AT;
    
    const p = (10.4 * RHO_L / RHO_F) / ((10.4 * RHO_L / RHO_F) + F);
    const EE = (K + GAMMA_F * F + GAMMA_L * L + currentDelta * currentWeight + BETA_TEF * EI + AT + 
               (EI - RHO_G * dG_dt) * (p * ETA_L / RHO_L + (1 - p) * ETA_F / RHO_F)) / 
               (1 + p * ETA_L / RHO_L + (1 - p) * ETA_F / RHO_F);
    
    F += (1 - p) * (EI - EE - RHO_G * dG_dt) / RHO_F;
    L += p * (EI - EE - RHO_G * dG_dt) / RHO_L;
    G += dG_dt;
    ECF += dECF_dt;
    AT += dAT_dt;
  }
  
  return results;
}
