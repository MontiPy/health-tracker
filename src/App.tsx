import { useState, useEffect, useMemo } from 'react';
import {
  simulate,
  calculateMaintenanceCalories,
  solveForGoalCalories,
  toDisplayWeight,
} from './models/hallModel';
import type { UserProfile, DayLog, ModelResult } from './models/hallModel';
import WeightChart from './components/WeightChart';
import ProfileForm from './components/ProfileForm';
import LogForm from './components/LogForm';
import { useAuth } from './contexts/useAuth';
import { pushToSupabase } from './lib/sync';
import AuthButton from './components/AuthButton';
import {
  Home, Target, Plus, History, User,
  Activity, BarChart3, Table as TableIcon,
  Flame, Zap, ChevronRight, Calendar,
  Download, Edit2, ChevronDown, ChevronUp,
} from 'lucide-react';

const STORAGE_KEY_PROFILE    = 'health_tracker_profile';
const STORAGE_KEY_LOGS       = 'health_tracker_logs';
const STORAGE_KEY_START_DATE = 'health_tracker_start_date';
const STORAGE_KEY_ENERGY_UNIT = 'health_tracker_energy_unit';
const KCAL_TO_KJ = 4.184;
const TABLE_DEFAULT_ROWS = 20;

type View         = 'dashboard' | 'planner' | 'log' | 'history' | 'profile';
type EnergyUnit   = 'kcal' | 'kj';
type DashboardTab = 'chart' | 'table';

/* ── date helpers ─────────────────────────────────────────────────────────── */
function fmtDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}
function dayToDate(day: number, start: Date) {
  const d = new Date(start);
  d.setDate(d.getDate() + day);
  return fmtDate(d);
}
function daysFromToday(dateStr: string, ref: Date) {
  // Parse as local midnight to avoid UTC-offset off-by-one in US timezones
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.max(1, Math.round((target.getTime() - refMidnight.getTime()) / 86_400_000));
}

/* ── classification helpers ────────────────────────────────────────────────── */
function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', cls: 'text-blue-500' };
  if (bmi < 25)   return { label: 'Normal',      cls: 'text-teal-600' };
  if (bmi < 30)   return { label: 'Overweight',  cls: 'text-amber-500' };
  return                 { label: 'Obese',        cls: 'text-red-500' };
}
function fatCategory(pct: number, sex: 'male' | 'female') {
  const m = sex === 'male';
  if (pct < (m ? 6  : 14)) return { label: 'Essential', cls: 'text-blue-500' };
  if (pct < (m ? 14 : 21)) return { label: 'Athletic',  cls: 'text-teal-600' };
  if (pct < (m ? 18 : 25)) return { label: 'Fitness',   cls: 'text-teal-500' };
  if (pct < (m ? 25 : 32)) return { label: 'Average',   cls: 'text-amber-500' };
  return                           { label: 'Obese',     cls: 'text-red-500'  };
}

/* ── CSV export ───────────────────────────────────────────────────────────── */
function exportCSV(results: ModelResult[], logs: DayLog[], units: 'metric' | 'imperial', startDate: Date) {
  const u = units === 'metric' ? 'kg' : 'lbs';
  const header = ['Day', 'Date', `Weight(${u})`, `High(${u})`, `Low(${u})`, `Actual(${u})`, 'FatMass(kg)', 'LeanMass(kg)', 'BMI', 'BodyFat%'];
  const rows = results.map(r => {
    const log = logs.find(l => l.day === r.day);
    return [
      r.day,
      dayToDate(r.day, startDate),
      toDisplayWeight(r.predictedWeightKg, units).toFixed(1),
      toDisplayWeight(r.highEstWeightKg, units).toFixed(1),
      toDisplayWeight(r.lowEstWeightKg, units).toFixed(1),
      log ? toDisplayWeight(log.weightKg, units).toFixed(1) : '',
      r.fatMassKg.toFixed(2),
      r.leanMassKg.toFixed(2),
      r.bmi.toFixed(1),
      r.bodyFatPct.toFixed(1),
    ].join(',');
  });
  const csv  = [header.join(','), ...rows].join('\n');
  const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'simulation.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Shared UI atoms ──────────────────────────────────────────────────────── */
function StatCell({
  label, value, unit, accent, category,
}: { label: string; value: string; unit?: string; accent?: boolean; category?: { label: string; cls: string } }) {
  return (
    <div className="text-center">
      <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-1 leading-tight">{label}</p>
      <p className={`font-data font-bold text-sm leading-none ${accent ? 'text-teal-700' : 'text-slate-700'}`}>
        {value}
        {unit && <span className={`text-[9px] font-normal ml-0.5 ${accent ? 'text-teal-500' : 'text-slate-400'}`}>{unit}</span>}
      </p>
      {category && <p className={`text-[8px] font-semibold mt-0.5 ${category.cls}`}>{category.label}</p>}
    </div>
  );
}

function EnergyToggle({ unit, onChange, dark }: { unit: EnergyUnit; onChange: (u: EnergyUnit) => void; dark?: boolean }) {
  return (
    <div className={`flex p-0.5 rounded-lg ${dark ? 'bg-teal-800/40' : 'bg-slate-100'}`}>
      {(['kcal', 'kj'] as EnergyUnit[]).map(u => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase ${
            unit === u
              ? dark ? 'bg-white/20 text-white' : 'bg-white shadow-sm text-teal-700'
              : dark ? 'text-teal-300' : 'text-slate-400'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: {
  active: boolean; icon: React.ElementType; label: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${active ? 'text-teal-600' : 'text-slate-400'}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
      <span className="text-[9px] mt-1 font-semibold tracking-widest uppercase">{label}</span>
    </button>
  );
}

function ResultCard({ label, value, unit, variant }: {
  label: string; value: number; unit: string; variant: 'muted' | 'primary' | 'accent';
}) {
  const s = {
    muted:   { wrap: 'bg-slate-50 border border-slate-100',   text: 'text-slate-700', sub: 'text-slate-400',  lbl: 'text-slate-500' },
    primary: { wrap: 'bg-teal-700 shadow-lg shadow-teal-100', text: 'text-white',     sub: 'text-teal-300',   lbl: 'text-teal-200'  },
    accent:  { wrap: 'bg-teal-50 border border-teal-100',    text: 'text-teal-800',  sub: 'text-teal-500',   lbl: 'text-teal-600'  },
  }[variant];
  return (
    <div className={`${s.wrap} rounded-2xl p-4 flex justify-between items-center gap-3`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest leading-snug ${s.lbl} max-w-[55%]`}>{label}</p>
      <p className={`font-data font-bold text-2xl ${s.text} shrink-0`}>
        {value.toLocaleString()}
        <span className={`text-[9px] font-normal ml-1 ${s.sub}`}>{unit}</span>
      </p>
    </div>
  );
}

/* ── GoalStep — uses local state, commits only on Calculate ───────────────── */
function GoalStep({ profile, setProfile, onBack, onNext, startDate }: {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  onBack: () => void;
  onNext: () => void;
  startDate: Date;
}) {
  const [goalMode, setGoalMode] = useState<'days' | 'date'>('days');
  const [local, setLocal] = useState({
    goalWeightKg:             profile.goalWeightKg,
    goalDays:                 profile.goalDays,
    activityChangeReachPct:   profile.activityChangeReachPct,
    activityChangeMaintainPct: profile.activityChangeMaintainPct,
  });
  // Separate string state for the goal weight input so the user can type freely
  // without the controlled value fighting each keystroke
  const [goalWeightStr, setGoalWeightStr] = useState(
    profile.goalWeightKg ? toDisplayWeight(profile.goalWeightKg, profile.units).toFixed(1) : ''
  );

  const unitLabel = profile.units === 'metric' ? 'kg' : 'lbs';
  const goalDispKg = local.goalWeightKg ?? 0;
  const lossKg = profile.initialWeightKg - goalDispKg;
  const direction = Math.abs(lossKg) < 0.5 ? 'same'
                  : lossKg > 0 ? 'loss' : 'gain';
  const lossDisp = Math.abs(toDisplayWeight(Math.abs(lossKg), profile.units));

  const goalDateStr = local.goalDays
    ? (() => { const d = new Date(startDate); d.setDate(d.getDate() + local.goalDays!); return d.toISOString().slice(0, 10); })()
    : '';

  const canContinue = !!local.goalWeightKg && !!local.goalDays && direction !== 'same';

  const handleNext = () => {
    setProfile(prev => prev ? { ...prev, ...local } : null);
    onNext();
  };

  const inp = 'w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-teal-400 focus:outline-none font-data font-bold text-xl text-center text-slate-900 bg-white transition-colors';

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 anim-scale-in">
      <div>
        <h2 className="font-display font-bold text-xl text-slate-900 tracking-tight">Set Your Goal</h2>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Step 2 of 3</p>
      </div>

      {/* Goal weight */}
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Goal Weight ({unitLabel})
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={profile.units === 'metric' ? 30 : 66}
          max={profile.units === 'metric' ? 300 : 660}
          className={inp}
          placeholder={profile.units === 'metric' ? '75.0' : '165.0'}
          value={goalWeightStr}
          onChange={e => {
            const str = e.target.value;
            setGoalWeightStr(str);
            const val = parseFloat(str);
            if (!isNaN(val) && val > 0)
              setLocal(prev => ({ ...prev, goalWeightKg: profile.units === 'metric' ? val : val / 2.20462 }));
          }}
          required
        />
        {/* Direction feedback */}
        {local.goalWeightKg && direction === 'same' && (
          <p className="text-[10px] text-amber-500 font-semibold mt-1.5 text-center">
            Goal equals current weight — please enter a different target
          </p>
        )}
        {local.goalWeightKg && direction !== 'same' && (
          <p className={`text-[10px] font-semibold mt-1.5 text-center ${direction === 'loss' ? 'text-teal-600' : 'text-blue-500'}`}>
            {direction === 'loss' ? '↓' : '↑'} {lossDisp.toFixed(1)} {unitLabel} to {direction === 'loss' ? 'lose' : 'gain'}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
          I want to reach my goal
        </label>
        <div className="flex bg-slate-50 p-0.5 rounded-xl mb-3">
          {(['days', 'date'] as const).map(m => (
            <button key={m} type="button" onClick={() => setGoalMode(m)}
              className={`flex-1 py-2 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                goalMode === m ? 'bg-white shadow-sm text-teal-700' : 'text-slate-400'
              }`}
            >
              {m === 'date' && <Calendar size={10} />}
              {m === 'days' ? 'In N Days' : 'By Date'}
            </button>
          ))}
        </div>
        {goalMode === 'days' ? (
          <input type="number" inputMode="numeric" min={1} max={3650} className={inp} placeholder="90"
            value={local.goalDays || ''}
            onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n > 0) setLocal(prev => ({ ...prev, goalDays: n })); }}
            required
          />
        ) : (
          <input type="date" className={inp + ' text-lg'}
            value={goalDateStr}
            min={new Date(startDate.getTime() + 86_400_000).toISOString().slice(0, 10)}
            onChange={e => setLocal(prev => ({ ...prev, goalDays: daysFromToday(e.target.value, startDate) }))}
          />
        )}
        {local.goalDays && (
          <p className="text-center text-[10px] text-teal-600 font-semibold mt-1.5">
            {local.goalDays} days · Target: {goalDateStr.replace(/-/g, '/')}
          </p>
        )}
      </div>

      {/* Activity change */}
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Physical Activity Change <span className="text-slate-300 font-normal">(optional)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'activityChangeReachPct' as const,    label: 'Weight Change Phase', sub: 'During reach phase',    accent: 'text-teal-600' },
            { key: 'activityChangeMaintainPct' as const, label: 'Maintenance Phase',   sub: 'At goal weight',        accent: 'text-cyan-600' },
          ].map(({ key, label, sub, accent }) => (
            <div key={key}>
              <label className={`block text-[9px] font-semibold ${accent} uppercase tracking-widest mb-1.5`}>{label}</label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  step="1" min={-100} max={100}
                  className="w-full px-3 py-2.5 pr-6 rounded-xl border-2 border-slate-200 focus:border-teal-400 focus:outline-none font-data font-bold text-center text-slate-900 bg-white"
                  value={local[key]}
                  onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setLocal(prev => ({ ...prev, [key]: n })); }}
                />
                <span className="absolute right-3 top-2.5 text-[10px] font-bold text-slate-400">%</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1 text-center">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="flex-1 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-colors">Back</button>
        <button onClick={handleNext} disabled={!canContinue}
          className="flex-[2] bg-teal-600 text-white py-3.5 rounded-2xl font-display font-bold shadow-lg shadow-teal-100 disabled:opacity-30 uppercase tracking-wide text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          Calculate <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ── ResultsStep ──────────────────────────────────────────────────────────── */
function ResultsStep({ maintenanceCurrent, goalCalories, maintenanceAtGoal, goalDays, onStart }: {
  maintenanceCurrent: number; goalCalories: number; maintenanceAtGoal: number;
  goalDays?: number; onStart: () => void;
}) {
  const [eu, setEu] = useState<EnergyUnit>('kcal');
  const fmt = (k: number) => eu === 'kj' ? Math.round(k * KCAL_TO_KJ) : Math.round(k);
  const lbl = eu === 'kcal' ? 'kcal/day' : 'kJ/day';
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 anim-scale-in">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 tracking-tight">Results</h2>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Step 3 of 3</p>
        </div>
        <EnergyToggle unit={eu} onChange={setEu} />
      </div>
      <div className="space-y-3">
        <ResultCard label="To maintain your current weight, eat" value={fmt(maintenanceCurrent)} unit={lbl} variant="muted" />
        <ResultCard label={`To reach your goal in ${goalDays ?? '—'} days, eat`} value={fmt(goalCalories)} unit={lbl} variant="primary" />
        <ResultCard label="To maintain your goal weight, eat" value={fmt(maintenanceAtGoal)} unit={lbl} variant="accent" />
      </div>
      <button onClick={onStart}
        className="w-full bg-teal-600 text-white py-4 rounded-2xl font-display font-bold shadow-xl shadow-teal-100 uppercase tracking-wide text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        Start My Plan <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Main App                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */
function App() {
  const { user } = useAuth();
  /* ── persisted state ──────────────────────────────────────────────────── */
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const s = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!s) return null;
    return { units: 'metric', activityChangeReachPct: 0, activityChangeMaintainPct: 0, uncertaintyPct: 5, ...JSON.parse(s) };
  });

  const [logs, setLogs] = useState<DayLog[]>(() => {
    const s = localStorage.getItem(STORAGE_KEY_LOGS);
    return s ? JSON.parse(s) : [];
  });

  const [startDate, setStartDate] = useState<Date>(() => {
    const s = localStorage.getItem(STORAGE_KEY_START_DATE);
    return s ? new Date(s) : new Date();
  });

  const [energyUnit, setEnergyUnit] = useState<EnergyUnit>(() =>
    (localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) as EnergyUnit) ?? 'kcal'
  );

  /* ── ephemeral UI state ───────────────────────────────────────────────── */
  const [view, setView]             = useState<View>(profile ? 'dashboard' : 'planner');
  const [plannerStep, setPlannerStep] = useState(1);
  const [dashTab, setDashTab]       = useState<DashboardTab>('chart');
  const [tableExpanded, setTableExpanded] = useState(false);
  const [editLog, setEditLog]       = useState<DayLog | null>(null);  // for history editing

  /* ── persistence side-effects ─────────────────────────────────────────── */
  useEffect(() => {
    if (profile) {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
      if (user) {
        const sd = localStorage.getItem(STORAGE_KEY_START_DATE) ?? startDate.toISOString().slice(0, 10);
        const eu = localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) ?? 'kcal';
        pushToSupabase(user.id, profile, logs, sd, eu).catch(console.error);
      }
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    if (user && profile) {
      const sd = localStorage.getItem(STORAGE_KEY_START_DATE) ?? startDate.toISOString().slice(0, 10);
      const eu = localStorage.getItem(STORAGE_KEY_ENERGY_UNIT) ?? 'kcal';
      pushToSupabase(user.id, profile, logs, sd, eu).catch(console.error);
    }
  }, [logs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENERGY_UNIT, energyUnit);
  }, [energyUnit]);

  /* ── derived values ───────────────────────────────────────────────────── */
  const goalCalories = useMemo(() => {
    if (!profile?.goalWeightKg || !profile.goalDays) return 0;
    return solveForGoalCalories(profile, profile.goalWeightKg, profile.goalDays);
  }, [profile]);

  const maintenanceAtGoal = useMemo(() =>
    profile?.goalWeightKg ? calculateMaintenanceCalories(profile, profile.goalWeightKg) : 0,
  [profile]);

  const maintenanceCurrent = useMemo(() =>
    profile ? calculateMaintenanceCalories(profile, profile.initialWeightKg) : 0,
  [profile]);

  const simulationResults = useMemo(() => {
    if (!profile) return [];
    const days = Math.max(90, (profile.goalDays || 0) + 30);
    return simulate(profile, logs, days, goalCalories > 0 ? goalCalories : undefined);
  }, [profile, logs, goalCalories]);

  const nextDay = useMemo(() =>
    logs.length > 0 ? Math.max(...logs.map(l => l.day)) + 1 : 0,
  [logs]);

  const daysElapsed = nextDay > 0 ? nextDay - 1 : 0;
  const progressPct = profile?.goalDays ? Math.min(100, (daysElapsed / profile.goalDays) * 100) : 0;
  const unitLabel   = profile?.units === 'metric' ? 'kg' : 'lbs';
  const currentWtKg = logs.length > 0 ? logs[logs.length - 1].weightKg : profile?.initialWeightKg ?? 0;

  const displayEnergy = (kcal: number) => energyUnit === 'kj' ? Math.round(kcal * KCAL_TO_KJ) : Math.round(kcal);
  const energyLabel   = energyUnit === 'kcal' ? 'kcal/day' : 'kJ/day';

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const handleProfileSubmit = (p: UserProfile) => {
    // When editing from the profile page, preserve goal fields that ProfileForm doesn't manage
    const merged = (view !== 'planner' && profile)
      ? { ...p, goalWeightKg: profile.goalWeightKg, goalDays: profile.goalDays }
      : p;
    setProfile(merged);
    if (!localStorage.getItem(STORAGE_KEY_START_DATE)) {
      localStorage.setItem(STORAGE_KEY_START_DATE, startDate.toISOString());
    }
    if (view === 'planner') setPlannerStep(2);
    else setView('dashboard');
  };

  const handleLogSubmit = (newLog: DayLog) => {
    setLogs(prev => {
      const idx = prev.findIndex(l => l.day === newLog.day);
      if (idx >= 0) { const u = [...prev]; u[idx] = newLog; return u; }
      return [...prev, newLog].sort((a, b) => a.day - b.day);
    });
    setEditLog(null);
    setView('dashboard');
  };

  /* ── initial/goal stat row data ───────────────────────────────────────── */
  const initBmi   = simulationResults[0]?.bmi;
  const initFat   = simulationResults[0]?.bodyFatPct;
  const goalResult = profile?.goalDays ? simulationResults[profile.goalDays] : undefined;

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col pb-24 antialiased text-slate-900" style={{ background: 'var(--teal-50)' }}>

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-xl px-5 py-3.5 flex justify-between items-center sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-teal-600 p-2 rounded-xl shadow-md shadow-teal-100">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm text-slate-900 leading-none tracking-tight">Body Weight Planner</h1>
            <p className="text-[8px] font-semibold text-teal-600 uppercase tracking-widest leading-none mt-0.5">Hall (2011) Model</p>
          </div>
        </div>
        {profile && view === 'dashboard' && (
          <div className="text-right">
            <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Current</p>
            <p className="font-data font-bold text-teal-700 text-base leading-none">
              {toDisplayWeight(currentWtKg, profile.units).toFixed(1)}
              <span className="text-[10px] text-slate-400 ml-0.5">{unitLabel}</span>
            </p>
          </div>
        )}
        <AuthButton />
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">

        {/* ════════ WELCOME (no profile) ════════ */}
        {!profile && view !== 'planner' && (
          <div className="flex flex-col items-center justify-center py-24 text-center anim-fade-in">
            <div className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              <Activity size={40} className="text-teal-600" />
            </div>
            <h2 className="font-display font-bold text-2xl text-slate-900 mb-2 tracking-tight">Welcome</h2>
            <p className="text-slate-500 text-sm mb-8 max-w-xs">
              Set up your profile to get a scientifically-grounded weight loss plan.
            </p>
            <button onClick={() => setView('planner')}
              className="bg-teal-600 text-white px-8 py-4 rounded-2xl font-display font-bold shadow-xl shadow-teal-100 uppercase tracking-wide text-sm flex items-center gap-2"
            >
              Get Started <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ════════ DASHBOARD ════════ */}
        {view === 'dashboard' && profile && (
          <div className="space-y-4">

            {/* Progress bar */}
            {profile.goalDays && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 anim-fade-up delay-1">
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Goal Progress</span>
                  <span className="font-data text-xs text-teal-700 font-bold">Day {daysElapsed} of {profile.goalDays}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #0d9488, #22d3ee)' }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] text-slate-400 font-medium">{fmtDate(startDate)}</span>
                  <span className="text-[9px] text-teal-600 font-semibold">
                    {Math.max(0, profile.goalDays - daysElapsed)} days remaining
                  </span>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 anim-fade-up delay-2">
              <div className="grid grid-cols-3 gap-3">
                <StatCell label="Start Weight"
                  value={toDisplayWeight(profile.initialWeightKg, profile.units).toFixed(1)} unit={unitLabel} />
                <StatCell label="Start BMI"
                  value={initBmi?.toFixed(1) ?? '—'}
                  category={initBmi ? bmiCategory(initBmi) : undefined} />
                <StatCell label="Start Fat %"
                  value={initFat ? `${initFat.toFixed(1)}%` : '—'}
                  category={initFat ? fatCategory(initFat, profile.sex) : undefined} />
              </div>
              <div className="h-px bg-teal-50 my-3.5" />
              <div className="grid grid-cols-3 gap-3">
                <StatCell accent label="Goal Weight"
                  value={profile.goalWeightKg ? toDisplayWeight(profile.goalWeightKg, profile.units).toFixed(1) : '—'}
                  unit={profile.goalWeightKg ? unitLabel : ''} />
                <StatCell accent label="Goal BMI"
                  value={goalResult?.bmi.toFixed(1) ?? '—'}
                  category={goalResult ? bmiCategory(goalResult.bmi) : undefined} />
                <StatCell accent label="Goal Fat %"
                  value={goalResult ? `${goalResult.bodyFatPct.toFixed(1)}%` : '—'}
                  category={goalResult ? fatCategory(goalResult.bodyFatPct, profile.sex) : undefined} />
              </div>
            </div>

            {/* Calorie prescription */}
            <div className="rounded-3xl p-5 text-white shadow-xl shadow-teal-200 anim-fade-up delay-3"
              style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #0891b2 100%)' }}
            >
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-[9px] font-semibold text-teal-200 uppercase tracking-[0.2em]">Daily Calorie Prescription</p>
                  {profile.goalDays && (
                    <p className="text-[9px] text-teal-300 mt-0.5">Day {daysElapsed} of {profile.goalDays}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <EnergyToggle unit={energyUnit} onChange={setEnergyUnit} dark />
                  <button
                    onClick={() => { setPlannerStep(2); setView('planner'); }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    title="Edit goal"
                  >
                    <Edit2 size={12} className="text-teal-200" />
                  </button>
                </div>
              </div>
              <div className="space-y-3 mt-4">
                {[
                  { icon: Flame,  label: 'Current maintenance',                 kcal: maintenanceCurrent, size: 'sm' as const },
                  { icon: Target, label: `Reach goal in ${profile.goalDays ?? '—'} days`, kcal: goalCalories,        size: 'lg' as const },
                  { icon: Zap,    label: 'Maintain goal weight',                 kcal: maintenanceAtGoal,  size: 'sm' as const },
                ].map(({ icon: Icon, label, kcal, size }, i) => (
                  <div key={i} className={`flex justify-between items-center ${i < 2 ? 'border-b border-white/10 pb-3' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Icon size={13} className="text-teal-300 shrink-0" />
                      <span className={`font-medium text-teal-100 ${size === 'lg' ? 'text-xs font-semibold text-white' : 'text-[10px]'}`}>{label}</span>
                    </div>
                    <span className={`font-data font-bold tabular-nums ${size === 'lg' ? 'text-2xl text-cyan-300' : 'text-base text-white'}`}>
                      {displayEnergy(kcal).toLocaleString()}
                      <span className="text-[9px] font-normal text-teal-300 ml-1">{energyLabel}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart / Table */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 anim-fade-up delay-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Simulation</h2>
                <div className="flex items-center gap-2">
                  {dashTab === 'table' && (
                    <button
                      onClick={() => exportCSV(simulationResults, logs, profile.units, startDate)}
                      className="flex items-center gap-1 text-[9px] font-semibold text-teal-600 uppercase tracking-widest hover:text-teal-800 transition-colors"
                    >
                      <Download size={12} /> CSV
                    </button>
                  )}
                  <div className="flex bg-slate-50 p-0.5 rounded-lg">
                    {([['chart', BarChart3], ['table', TableIcon]] as const).map(([tab, Icon]) => (
                      <button key={tab} onClick={() => setDashTab(tab)}
                        className={`p-2 rounded-md transition-all ${dashTab === tab ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400'}`}
                      >
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {dashTab === 'chart' ? (
                <WeightChart
                  results={simulationResults}
                  logs={logs}
                  units={profile.units}
                  startDate={startDate}
                  goalDay={profile.goalDays}
                />
              ) : (
                <div>
                  <div className="max-h-96 overflow-y-auto -mx-1">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-100">
                          {['Day', 'Date', 'Weight', 'High', 'Low'].map((h, i) => (
                            <th key={h} className={`py-2 font-semibold text-[9px] uppercase tracking-wider ${i >= 2 ? 'text-right' : 'text-left'} ${i === 2 ? 'text-teal-600' : 'text-slate-400'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(tableExpanded ? simulationResults : simulationResults.slice(0, TABLE_DEFAULT_ROWS)).map(r => {
                          const isGoal = r.day === profile.goalDays;
                          const hasLog = logs.some(l => l.day === r.day);
                          return (
                            <tr key={r.day} className={`border-b border-slate-50 ${isGoal ? 'bg-teal-50' : ''}`}>
                              <td className={`py-1.5 font-data font-bold ${isGoal ? 'text-teal-700' : 'text-slate-400'}`}>{r.day}</td>
                              <td className={`py-1.5 text-[10px] font-medium ${isGoal ? 'text-teal-600' : 'text-slate-500'}`}>{dayToDate(r.day, startDate)}</td>
                              <td className={`py-1.5 text-right font-data font-bold ${hasLog ? 'text-teal-600' : isGoal ? 'text-teal-700' : 'text-slate-700'}`}>{toDisplayWeight(r.predictedWeightKg, profile.units).toFixed(1)}</td>
                              <td className="py-1.5 text-right font-data text-slate-300 text-[10px]">{toDisplayWeight(r.highEstWeightKg, profile.units).toFixed(1)}</td>
                              <td className="py-1.5 text-right font-data text-slate-300 text-[10px]">{toDisplayWeight(r.lowEstWeightKg, profile.units).toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {simulationResults.length > TABLE_DEFAULT_ROWS && (
                    <button
                      onClick={() => setTableExpanded(v => !v)}
                      className="w-full mt-2 py-2 text-[10px] font-semibold text-teal-600 uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-teal-50 rounded-xl transition-colors"
                    >
                      {tableExpanded ? <><ChevronUp size={12} /> Show Less</> : <><ChevronDown size={12} /> Show All {simulationResults.length} Days</>}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Log button */}
            <button onClick={() => { setEditLog(null); setView('log'); }}
              className="w-full bg-white border-2 border-teal-500 text-teal-700 py-4 rounded-3xl font-display font-bold uppercase tracking-widest text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 anim-fade-up delay-5"
            >
              <Plus size={17} /> Log Today's Weight
            </button>
          </div>
        )}

        {/* ════════ PLANNER ════════ */}
        {view === 'planner' && (
          <div className="space-y-5 anim-fade-up">
            {/* Step indicators */}
            <div className="flex items-center gap-2 px-2">
              {(['Profile', 'Goal', 'Results'] as const).map((label, i) => {
                const s = i + 1;
                return (
                  <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
                    <div className={`w-8 h-8 rounded-2xl flex items-center justify-center font-display font-bold text-sm transition-all shrink-0 ${
                      plannerStep === s ? 'bg-teal-600 text-white shadow-md shadow-teal-100' :
                      plannerStep > s  ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
                    }`}>{s}</div>
                    <span className={`text-[9px] font-semibold uppercase tracking-widest whitespace-nowrap ${plannerStep === s ? 'text-teal-700' : 'text-slate-400'}`}>{label}</span>
                    {i < 2 && <div className={`flex-1 h-px ${plannerStep > s ? 'bg-teal-200' : 'bg-slate-200'}`} />}
                  </div>
                );
              })}
            </div>

            {plannerStep === 1 && <ProfileForm initialProfile={profile ?? undefined} onSubmit={handleProfileSubmit} />}
            {plannerStep === 2 && profile && (
              <GoalStep
                profile={profile}
                setProfile={setProfile}
                onBack={() => setPlannerStep(1)}
                onNext={() => setPlannerStep(3)}
                startDate={startDate}
              />
            )}
            {plannerStep === 3 && profile && (
              <ResultsStep
                maintenanceCurrent={maintenanceCurrent}
                goalCalories={goalCalories}
                maintenanceAtGoal={maintenanceAtGoal}
                goalDays={profile.goalDays}
                onStart={() => { setView('dashboard'); setPlannerStep(1); }}
              />
            )}
          </div>
        )}

        {/* ════════ LOG ════════ */}
        {view === 'log' && (
          <div className="anim-scale-in">
            <LogForm
              day={editLog ? editLog.day : nextDay}
              units={profile?.units ?? 'metric'}
              initialLog={editLog ?? {
                day: nextDay,
                weightKg: logs.length > 0 ? logs[logs.length - 1].weightKg : profile?.initialWeightKg ?? 80,
                calories: goalCalories || profile?.initialCalories || 2000,
              }}
              predictedWeight={simulationResults[editLog ? editLog.day : nextDay]?.predictedWeightKg}
              date={dayToDate(editLog ? editLog.day : nextDay, startDate)}
              onSubmit={handleLogSubmit}
              onCancel={() => { setEditLog(null); setView(profile ? 'dashboard' : 'planner'); }}
            />
          </div>
        )}

        {/* ════════ HISTORY ════════ */}
        {view === 'history' && (
          <div className="anim-fade-in space-y-4">
            <h2 className="font-display font-bold text-xl text-slate-900 tracking-tight">History</h2>
            {logs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <History size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 font-semibold uppercase tracking-widest text-[10px]">No entries yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest px-1">Tap any entry to edit</p>
                {[...logs].reverse().map(log => (
                  <button
                    key={log.day}
                    onClick={() => { setEditLog(log); setView('log'); }}
                    className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                        <span className="font-data font-bold text-teal-700 text-[10px]">D{log.day}</span>
                      </div>
                      <div>
                        <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                          {dayToDate(log.day, startDate)}
                        </p>
                        <p className="font-data font-bold text-slate-900">
                          {toDisplayWeight(log.weightKg, profile?.units ?? 'metric').toFixed(1)}
                          <span className="text-[10px] text-slate-400 ml-0.5">{unitLabel}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[8px] font-semibold text-teal-500 uppercase tracking-widest mb-0.5">Intake</p>
                        <p className="font-data font-bold text-teal-700">
                          {log.calories.toLocaleString()}
                          <span className="text-[10px] text-slate-400 ml-0.5">kcal</span>
                        </p>
                      </div>
                      <Edit2 size={13} className="text-slate-300 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ PROFILE ════════ */}
        {view === 'profile' && profile && (
          <div className="anim-fade-in space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center shrink-0">
                <User size={24} className="text-teal-600" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-slate-900 tracking-tight">Your Profile</h2>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Edit settings & units</p>
              </div>
            </div>
            <ProfileForm
              initialProfile={profile}
              onSubmit={handleProfileSubmit}
              onCancel={() => setView('dashboard')}
              submitLabel="Save Changes"
            />

            {/* Start Date */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Plan Start Date
              </label>
              <input
                type="date"
                value={startDate.toISOString().slice(0, 10)}
                onChange={e => {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  const next = new Date(y, m - 1, d);
                  setStartDate(next);
                  localStorage.setItem(STORAGE_KEY_START_DATE, next.toISOString());
                }}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-teal-400 focus:outline-none font-data font-bold text-slate-900 bg-white transition-colors text-sm"
              />
              <p className="text-[9px] text-slate-400 mt-1.5 ml-1">
                Adjusts all date labels on the chart and table — does not affect logged data.
              </p>
            </div>

            <button
              onClick={() => { if (confirm('Permanently delete all data?')) { localStorage.clear(); window.location.reload(); } }}
              className="w-full py-4 text-red-400 font-semibold uppercase tracking-widest text-[10px] hover:bg-red-50 rounded-2xl transition-colors"
            >
              Reset All Data
            </button>
          </div>
        )}
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-xl border-t border-slate-100 px-3 py-2 flex justify-around items-center z-40 pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.04)]">
        <NavButton active={view === 'dashboard'} icon={Home}    label="Home"    onClick={() => setView('dashboard')} />
        <NavButton active={view === 'planner'}   icon={Target}  label="Plan"    onClick={() => setView('planner')} />
        <div className="relative -top-6">
          <button
            onClick={() => { setEditLog(null); setView('log'); }}
            className="bg-teal-600 text-white p-4 rounded-[1.5rem] shadow-2xl shadow-teal-300 active:scale-90 transition-all border-4 border-white"
          >
            <Plus size={26} />
          </button>
        </div>
        <NavButton active={view === 'history'} icon={History} label="History" onClick={() => setView('history')} />
        <NavButton active={view === 'profile'} icon={User}    label="Me"      onClick={() => setView('profile')} />
      </nav>
    </div>
  );
}

export default App;
