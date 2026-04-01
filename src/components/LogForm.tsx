import { useState } from 'react';
import type { DayLog } from '../models/hallModel';
import { Scale, X, ArrowRight } from 'lucide-react';

interface LogFormProps {
  day: number;
  units: 'metric' | 'imperial';
  initialLog?: DayLog;
  predictedWeight?: number;
  date?: string;
  onSubmit: (log: DayLog) => void;
  onCancel?: () => void;
}

const LogForm: React.FC<LogFormProps> = ({
  day, units, initialLog, predictedWeight, date, onSubmit, onCancel,
}) => {
  const initLog = initialLog ?? { day, weightKg: 80, calories: 2000 };
  const [log, setLog]               = useState<DayLog>(initLog);
  const [displayWeight, setDisplay] = useState(
    units === 'metric' ? initLog.weightKg : initLog.weightKg * 2.20462
  );

  const unitLabel = units === 'metric' ? 'kg' : 'lbs';
  const predDisp  = predictedWeight != null
    ? (units === 'metric' ? predictedWeight : predictedWeight * 2.20462)
    : null;

  const handleWeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const val = parseFloat(raw);
    setDisplay(isNaN(val) ? 0 : val);
    if (!isNaN(val) && val > 0) {
      setLog(prev => ({ ...prev, weightKg: units === 'metric' ? val : val / 2.20462 }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Belt-and-suspenders: don't submit if values are invalid
    if (isNaN(log.weightKg) || log.weightKg <= 0) return;
    onSubmit(log);
  };

  const fieldCls = 'w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-teal-400 focus:outline-none font-data font-bold text-2xl text-center text-slate-900 bg-white transition-colors';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-widest">{date ?? `Day ${day}`}</p>
          <h2 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Day {day}</h2>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Weight */}
      <div className="bg-slate-50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={14} className="text-teal-600" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Weight ({unitLabel})
          </span>
          {predDisp != null && (
            <span className="ml-auto text-[9px] text-slate-400">
              Predicted: <span className="font-data font-bold text-teal-600">{predDisp.toFixed(1)}</span>
            </span>
          )}
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={units === 'metric' ? 30 : 66}
          max={units === 'metric' ? 300 : 660}
          value={displayWeight}
          onChange={handleWeight}
          className={fieldCls}
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-teal-600 text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-teal-100 uppercase tracking-wide text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        Save Entry <ArrowRight size={17} />
      </button>
    </form>
  );
};

export default LogForm;
