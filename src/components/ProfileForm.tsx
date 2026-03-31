import { useState } from 'react';
import { 
  toDisplayWeight, 
  fromDisplayWeight 
} from '../models/hallModel';
import type { UserProfile } from '../models/hallModel';
import { Settings2 } from 'lucide-react';

interface ProfileFormProps {
  initialProfile?: UserProfile;
  onSubmit: (profile: UserProfile) => void;
  hideAdvanced?: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ initialProfile, onSubmit, hideAdvanced }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [units, setUnits] = useState<'metric' | 'imperial'>(initialProfile?.units || 'metric');
  
  // For imperial height, we need feet and inches separately
  const initialCm = initialProfile?.heightCm || 175;
  const initialInchesTotal = initialCm * 0.393701;
  const initialFeet = Math.floor(initialInchesTotal / 12);
  const initialInchesRemaining = Math.round(initialInchesTotal % 12);

  const [formData, setFormData] = useState({
    sex: initialProfile?.sex || 'male',
    age: initialProfile?.age || 33,
    height: units === 'metric' ? initialCm : initialInchesTotal,
    heightFeet: initialFeet,
    heightInches: initialInchesRemaining,
    weight: toDisplayWeight(initialProfile?.initialWeightKg || 80, initialProfile?.units || 'metric'),
    pal: initialProfile?.pal || 1.5,
    initialCalories: initialProfile?.initialCalories || 2500,
    activityChangeReachPct: initialProfile?.activityChangeReachPct || 0,
    activityChangeMaintainPct: initialProfile?.activityChangeMaintainPct || 0,
    uncertaintyPct: initialProfile?.uncertaintyPct || 5,
  });

  const toggleUnits = (newUnits: 'metric' | 'imperial') => {
    if (newUnits === units) return;
    
    setFormData(prev => {
      if (newUnits === 'metric') {
        const cm = (prev.heightFeet * 12 + prev.heightInches) * 2.54;
        return { ...prev, height: cm, weight: fromDisplayWeight(prev.weight, 'imperial') };
      } else {
        const totalInches = prev.height * 0.393701;
        return { 
          ...prev, 
          heightFeet: Math.floor(totalInches / 12), 
          heightInches: Math.round(totalInches % 12),
          weight: toDisplayWeight(fromDisplayWeight(prev.weight, 'metric'), 'imperial') 
        };
      }
    });
    setUnits(newUnits);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'sex' ? value : parseFloat(value),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalHeightCm = units === 'metric' 
      ? formData.height 
      : (formData.heightFeet * 12 + formData.heightInches) * 2.54;

    const finalProfile: UserProfile = {
      units,
      sex: formData.sex as 'male' | 'female',
      age: formData.age,
      heightCm: finalHeightCm,
      initialWeightKg: fromDisplayWeight(formData.weight, units),
      pal: formData.pal,
      initialCalories: formData.initialCalories,
      activityChangeReachPct: formData.activityChangeReachPct,
      activityChangeMaintainPct: formData.activityChangeMaintainPct,
      uncertaintyPct: formData.uncertaintyPct,
    };
    onSubmit(finalProfile);
  };

  const inputClass = "w-full p-3 rounded-xl border-2 border-gray-100 focus:border-blue-500 focus:outline-none font-bold";
  const labelClass = "block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Personal Info</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button type="button" onClick={() => toggleUnits('metric')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${units === 'metric' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>METRIC</button>
          <button type="button" onClick={() => toggleUnits('imperial')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${units === 'imperial' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>IMPERIAL</button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Sex</label>
          <select name="sex" value={formData.sex} onChange={handleChange} className={inputClass}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Age (yrs)</label>
          <input type="number" name="age" value={formData.age} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Height</label>
        {units === 'metric' ? (
          <div className="relative">
            <input type="number" name="height" value={formData.height} onChange={handleChange} className={inputClass} />
            <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-300">cm</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input type="number" name="heightFeet" value={formData.heightFeet} onChange={handleChange} className={inputClass} />
              <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-300">ft</span>
            </div>
            <div className="relative">
              <input type="number" name="heightInches" value={formData.heightInches} onChange={handleChange} className={inputClass} />
              <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-300">in</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Weight ({units === 'metric' ? 'kg' : 'lbs'})</label>
          <input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>PAL</label>
          <input type="number" step="0.1" name="pal" value={formData.pal} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Initial Calories</label>
        <input type="number" name="initialCalories" value={formData.initialCalories} onChange={handleChange} className={inputClass} />
      </div>

      {!hideAdvanced && (
        <div className="pt-2">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
            <Settings2 size={12} /> {showAdvanced ? 'Hide Advanced' : 'Show Advanced Controls'}
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-4 mt-2 border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className={labelClass}>Uncertainty %</label>
                  <input type="number" name="uncertaintyPct" value={formData.uncertaintyPct} onChange={handleChange} className={inputClass} />
                </div>
                <div className="col-span-1">
                  <label className={labelClass}>Reach %</label>
                  <input type="number" name="activityChangeReachPct" value={formData.activityChangeReachPct} onChange={handleChange} className={inputClass} />
                </div>
                <div className="col-span-1">
                  <label className={labelClass}>Keep %</label>
                  <input type="number" name="activityChangeMaintainPct" value={formData.activityChangeMaintainPct} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-100 uppercase tracking-widest text-xs active:scale-[0.98] transition-all">
        Continue to Goal
      </button>
    </form>
  );
};

export default ProfileForm;
