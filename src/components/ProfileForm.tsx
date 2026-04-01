import { useState } from 'react';
import { toDisplayWeight, fromDisplayWeight } from '../models/hallModel';
import type { UserProfile } from '../models/hallModel';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

interface ProfileFormProps {
  initialProfile?: UserProfile;
  onSubmit: (profile: UserProfile) => void;
}

const PAL_LEVELS = [
  { label: 'Sedentary',         description: 'Little/no exercise, desk job',       value: 1.2   },
  { label: 'Lightly Active',    description: 'Light exercise 1–3 days/week',        value: 1.375 },
  { label: 'Moderately Active', description: 'Moderate exercise 3–5 days/week',     value: 1.55  },
  { label: 'Very Active',       description: 'Hard exercise 6–7 days/week',         value: 1.725 },
  { label: 'Extra Active',      description: 'Very hard exercise or physical job',  value: 1.9   },
];

// 6'0" = 182.88 cm
const DEFAULT_HEIGHT_CM = 182.88;

const ProfileForm: React.FC<ProfileFormProps> = ({ initialProfile, onSubmit }) => {
  const [showPal, setShowPal] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>(initialProfile?.units ?? 'imperial');

  const initCm      = initialProfile?.heightCm ?? DEFAULT_HEIGHT_CM;
  const initInTotal = initCm * 0.393701;          // total inches, e.g. 72.00 for 6'0"

  const [f, setF] = useState({
    sex:          initialProfile?.sex ?? 'male',
    age:          initialProfile?.age ?? 33,
    // metric: stored in cm; imperial: stored as total inches (used only when switching back to metric)
    height:       (initialProfile?.units ?? 'imperial') === 'metric' ? initCm : initInTotal,
    heightFeet:   Math.floor(initInTotal / 12),   // 6 for 6'0"
    heightInches: Math.round(initInTotal % 12),   // 0 for 6'0"
    weight:       toDisplayWeight(initialProfile?.initialWeightKg ?? (200 / 2.20462), initialProfile?.units ?? 'imperial'),
    pal:          initialProfile?.pal ?? 1.5,
    uncertaintyPct:            initialProfile?.uncertaintyPct            ?? 5,
    activityChangeReachPct:    initialProfile?.activityChangeReachPct    ?? 0,
    activityChangeMaintainPct: initialProfile?.activityChangeMaintainPct ?? 0,
  });

  /* ── unit toggle: convert displayed values on switch ─────────────────── */
  const toggleUnits = (next: 'metric' | 'imperial') => {
    if (next === units) return;
    setF(prev => {
      if (next === 'metric') {
        const cm = (prev.heightFeet * 12 + prev.heightInches) * 2.54;
        return { ...prev, height: cm, weight: fromDisplayWeight(prev.weight, 'imperial') };
      }
      const totalIn = prev.height * 0.393701;
      return {
        ...prev,
        heightFeet:   Math.floor(totalIn / 12),
        heightInches: Math.round(totalIn % 12),
        weight:       toDisplayWeight(fromDisplayWeight(prev.weight, 'metric'), 'imperial'),
      };
    });
    setUnits(next);
  };

  /* ── generic numeric setter; keeps NaN out of state ──────────────────── */
  const num = (name: string, val: string) => {
    const n = parseFloat(val);
    // Allow the field to be cleared mid-type (empty string → keep previous)
    // but write the parsed number when valid
    if (val === '' || val === '-') return; // don't clobber while user is typing
    setF(prev => ({ ...prev, [name]: isNaN(n) ? prev[name as keyof typeof prev] : n }));
  };

  /* ── submit ───────────────────────────────────────────────────────────── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const heightCm =
      units === 'metric'
        ? f.height
        : (f.heightFeet * 12 + f.heightInches) * 2.54;
    const weightKg = fromDisplayWeight(f.weight, units);

    // Guard against NaN reaching the model (shouldn't happen with required+min/max
    // but belt-and-suspenders)
    if ([f.age, heightCm, weightKg, f.pal].some(v => isNaN(v) || v <= 0)) return;

    onSubmit({
      units,
      sex:             f.sex as 'male' | 'female',
      age:             f.age,
      heightCm,
      initialWeightKg: weightKg,
      pal:             f.pal,
      initialCalories: Math.round(weightKg * 30), // used only as LogForm calorie default
      activityChangeReachPct:    f.activityChangeReachPct,
      activityChangeMaintainPct: f.activityChangeMaintainPct,
      uncertaintyPct:  f.uncertaintyPct,
    });
  };

  const inputCls = 'w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-teal-400 focus:outline-none font-data font-bold text-slate-900 bg-white transition-colors text-sm';
  const labelCls = 'block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">

      {/* Header + unit toggle */}
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-xl text-slate-900 tracking-tight">Starting Information</h2>
        <div className="flex bg-slate-100 p-0.5 rounded-xl">
          {(['metric', 'imperial'] as const).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => toggleUnits(u)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${
                units === u ? 'bg-white shadow-sm text-teal-700' : 'text-slate-400'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Sex + Age */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Biological Sex</label>
          <select
            value={f.sex}
            onChange={e => setF(prev => ({ ...prev, sex: e.target.value as 'male' | 'female' }))}
            className={inputCls + ' appearance-none'}
            required
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Age (yrs)</label>
          <input
            type="number"
            inputMode="numeric"
            min={18} max={100}
            value={f.age}
            onChange={e => num('age', e.target.value)}
            className={inputCls}
            required
          />
        </div>
      </div>

      {/* Height */}
      <div>
        <label className={labelCls}>Height</label>
        {units === 'metric' ? (
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.1" min={100} max={250}
              value={f.height}
              onChange={e => num('height', e.target.value)}
              className={inputCls + ' pr-12'}
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={3} max={8}
                value={f.heightFeet}
                onChange={e => num('heightFeet', e.target.value)}
                className={inputCls + ' pr-10'}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">ft</span>
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={0} max={11}
                value={f.heightInches}
                onChange={e => num('heightInches', e.target.value)}
                className={inputCls + ' pr-10'}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">in</span>
            </div>
          </div>
        )}
      </div>

      {/* Weight */}
      <div>
        <label className={labelCls}>Weight ({units === 'metric' ? 'kg' : 'lbs'})</label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={units === 'metric' ? 30 : 66}
            max={units === 'metric' ? 300 : 660}
            value={f.weight}
            onChange={e => num('weight', e.target.value)}
            className={inputCls + ' pr-14'}
            required
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">
            {units === 'metric' ? 'kg' : 'lbs'}
          </span>
        </div>
      </div>

      {/* PAL with estimator */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className={labelCls + ' mb-0'}>Physical Activity Level (PAL)</label>
          <button
            type="button"
            onClick={() => setShowPal(v => !v)}
            className="flex items-center gap-1 text-[10px] font-semibold text-teal-600 uppercase tracking-widest"
          >
            <Info size={11} />
            Estimate Your Level
            {showPal ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>

        <input
          type="number"
          inputMode="decimal"
          step="0.025" min={1.0} max={2.5}
          value={f.pal}
          onChange={e => num('pal', e.target.value)}
          className={inputCls}
          required
        />

        {showPal && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-teal-100 bg-teal-50 anim-fade-in">
            {PAL_LEVELS.map(lvl => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => { setF(prev => ({ ...prev, pal: lvl.value })); setShowPal(false); }}
                className={`w-full px-4 py-3 flex justify-between items-center text-left border-b border-teal-100 last:border-0 hover:bg-teal-100 transition-colors ${
                  f.pal === lvl.value ? 'bg-teal-100' : ''
                }`}
              >
                <div>
                  <p className="font-semibold text-sm text-teal-900">{lvl.label}</p>
                  <p className="text-[10px] text-teal-600/70 mt-0.5">{lvl.description}</p>
                </div>
                <span className="font-data font-bold text-teal-700 text-sm shrink-0 ml-3">{lvl.value}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prediction uncertainty */}
      <div>
        <label className={labelCls}>Prediction Uncertainty (%)</label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0} max={20} step={1}
            value={f.uncertaintyPct}
            onChange={e => num('uncertaintyPct', e.target.value)}
            className={inputCls + ' pr-8'}
            required
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">%</span>
        </div>
        <p className="text-[9px] text-slate-400 mt-1.5 ml-1">Width of the simulation uncertainty band (±%)</p>
      </div>

      <button
        type="submit"
        className="w-full bg-teal-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-teal-100 uppercase tracking-wide text-sm active:scale-[0.98] transition-all"
      >
        Continue to Goal
      </button>
    </form>
  );
};

export default ProfileForm;
