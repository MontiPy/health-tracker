import { useState } from 'react';
import type { DayLog } from '../models/hallModel';

interface LogFormProps {
  day: number;
  units: 'metric' | 'imperial';
  initialLog?: DayLog;
  onSubmit: (log: DayLog) => void;
}

const LogForm: React.FC<LogFormProps> = ({ day, units, initialLog, onSubmit }) => {
  const [log, setLog] = useState<DayLog>(initialLog || {
    day,
    weightKg: 80,
    calories: 2000,
  });

  const [displayWeight, setDisplayWeight] = useState(
    units === 'metric' ? log.weightKg : log.weightKg * 2.20462
  );

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDisplayWeight(val);
    setLog(prev => ({
      ...prev,
      weightKg: units === 'metric' ? val : val / 2.20462,
    }));
  };

  const handleCalorieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLog(prev => ({ ...prev, calories: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(log);
  };

  const inputClass = "w-full p-3 rounded-xl border-2 border-gray-100 focus:border-blue-500 focus:outline-none font-bold text-lg text-center";
  const labelClass = "block text-[10px] font-bold text-gray-400 uppercase mb-1 text-center";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl shadow-md max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-800">Day {day}</h2>
        <p className="text-gray-500 text-sm">Quick Log</p>
      </div>
      
      <div>
        <label className={labelClass}>Weight ({units === 'metric' ? 'kg' : 'lbs'})</label>
        <input
          type="number"
          step="0.1"
          value={displayWeight}
          onChange={handleWeightChange}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label className={labelClass}>Calorie Intake (kcal)</label>
        <input
          type="number"
          value={log.calories}
          onChange={handleCalorieChange}
          className={inputClass}
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest"
      >
        Save Log Entry
      </button>
    </form>
  );
};

export default LogForm;
