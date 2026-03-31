import { useState, useEffect, useMemo } from 'react';
import { 
  simulate, 
  calculateMaintenanceCalories, 
  solveForGoalCalories,
  toDisplayWeight 
} from './models/hallModel';
import type { UserProfile, DayLog } from './models/hallModel';
import WeightChart from './components/WeightChart';
import ProfileForm from './components/ProfileForm';
import LogForm from './components/LogForm';
import { 
  Home, 
  Target, 
  Plus, 
  History, 
  User, 
  TrendingDown, 
  Calculator,
  Table as TableIcon,
  BarChart3
} from 'lucide-react';

const STORAGE_KEY_PROFILE = 'health_tracker_profile';
const STORAGE_KEY_LOGS = 'health_tracker_logs';

type View = 'dashboard' | 'planner' | 'log' | 'history' | 'profile';

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!saved) return null;
    const data = JSON.parse(saved);
    return {
      units: 'metric',
      activityChangeReachPct: 0,
      activityChangeMaintainPct: 0,
      uncertaintyPct: 5,
      ...data
    };
  });

  const [logs, setLogs] = useState<DayLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGS);
    return saved ? JSON.parse(saved) : [];
  });

  const [view, setView] = useState<View>(profile ? 'dashboard' : 'planner');
  const [plannerStep, setPlannerStep] = useState(1);
  const [dashboardMode, setDashboardMode] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    if (profile) {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }, [logs]);

  const goalCalories = useMemo(() => {
    if (!profile || !profile.goalWeightKg || !profile.goalDays) return 0;
    return solveForGoalCalories(profile, profile.goalWeightKg, profile.goalDays);
  }, [profile]);

  const maintenanceAtGoal = useMemo(() => {
    if (!profile || !profile.goalWeightKg) return 0;
    return calculateMaintenanceCalories(profile, profile.goalWeightKg);
  }, [profile]);

  const simulationResults = useMemo(() => {
    if (!profile) return [];
    const daysToSimulate = Math.max(90, (profile.goalDays || 0) + 30);
    return simulate(profile, logs, daysToSimulate, goalCalories > 0 ? goalCalories : undefined);
  }, [profile, logs, goalCalories]);

  const handleProfileSubmit = (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (view === 'planner') {
      setPlannerStep(2);
    } else {
      setView('dashboard');
    }
  };

  const handleLogSubmit = (newLog: DayLog) => {
    setLogs(prev => {
      const existingIndex = prev.findIndex(l => l.day === newLog.day);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newLog;
        return updated;
      }
      return [...prev, newLog].sort((a, b) => a.day - b.day);
    });
    setView('dashboard');
  };

  const NavButton = ({ active, icon: Icon, label, onClick }: any) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${
        active ? 'text-blue-600' : 'text-gray-400'
      }`}
    >
      <Icon size={24} />
      <span className="text-[10px] mt-1 font-medium tracking-wider uppercase">{label}</span>
    </button>
  );

  const unitLabel = profile?.units === 'metric' ? 'kg' : 'lbs';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 font-sans antialiased text-gray-900">
      <header className="bg-white px-6 py-5 flex justify-between items-center sticky top-0 z-30 border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
            <TrendingDown size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Health Tracker</h1>
        </div>
        {profile && view === 'dashboard' && (
          <div className="text-right">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Current Weight</p>
            <p className="text-lg font-black text-blue-600 leading-none">
              {toDisplayWeight(logs.length > 0 ? logs[logs.length-1].weightKg : profile.initialWeightKg, profile.units).toFixed(1)} <span className="text-xs uppercase">{unitLabel}</span>
            </p>
          </div>
        )}
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {view === 'dashboard' && profile && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Simulation Header Stats (NIH Style) */}
            <section className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Initial Weight</p>
                  <p className="text-sm font-black text-gray-800">{toDisplayWeight(profile.initialWeightKg, profile.units).toFixed(1)} {unitLabel}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Initial BMI</p>
                  <p className="text-sm font-black text-gray-800">{simulationResults[0]?.bmi.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Initial Fat %</p>
                  <p className="text-sm font-black text-gray-800">{simulationResults[0]?.bodyFatPct.toFixed(1)}%</p>
                </div>
              </div>
              <div className="h-px bg-gray-50 my-4"></div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Goal Weight</p>
                  <p className="text-sm font-black text-blue-600">{profile.goalWeightKg ? toDisplayWeight(profile.goalWeightKg, profile.units).toFixed(1) : '-'} {unitLabel}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Final BMI</p>
                  <p className="text-sm font-black text-blue-600">{profile.goalDays ? simulationResults[profile.goalDays]?.bmi.toFixed(1) : '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Final Fat %</p>
                  <p className="text-sm font-black text-blue-600">{profile.goalDays ? simulationResults[profile.goalDays]?.bodyFatPct.toFixed(1) : '-'}%</p>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div className="flex bg-gray-50 p-1 rounded-xl">
                  <button onClick={() => setDashboardMode('chart')} className={`p-2 rounded-lg transition-all ${dashboardMode === 'chart' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}><BarChart3 size={18} /></button>
                  <button onClick={() => setDashboardMode('table')} className={`p-2 rounded-lg transition-all ${dashboardMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}><TableIcon size={18} /></button>
                </div>
                <h2 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Simulation Displayed</h2>
              </div>
              
              {dashboardMode === 'chart' ? (
                <WeightChart results={simulationResults} logs={logs} units={profile.units} />
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-50">
                  <table className="w-full text-[10px] text-left">
                    <thead className="sticky top-0 bg-gray-50 font-black text-gray-400 uppercase">
                      <tr>
                        <th className="p-2">Day</th>
                        <th className="p-2">Weight</th>
                        <th className="p-2">High</th>
                        <th className="p-2">Low</th>
                      </tr>
                    </thead>
                    <tbody className="font-bold text-gray-600">
                      {simulationResults.filter((_, i) => i % 5 === 0).map(r => (
                        <tr key={r.day} className="border-t border-gray-50">
                          <td className="p-2">{r.day}</td>
                          <td className="p-2">{toDisplayWeight(r.predictedWeightKg, profile.units).toFixed(1)}</td>
                          <td className="p-2">{toDisplayWeight(r.highEstWeightKg, profile.units).toFixed(1)}</td>
                          <td className="p-2">{toDisplayWeight(r.lowEstWeightKg, profile.units).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-blue-600 p-8 rounded-[40px] shadow-2xl shadow-blue-200 text-white relative overflow-hidden">
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Goal Path Calculation</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold opacity-80 italic">To Reach Goal in {profile.goalDays} Days:</span>
                    <span className="text-3xl font-black">{Math.round(goalCalories)} <small className="text-xs font-bold opacity-75">KCAL/DAY</small></span>
                  </div>
                  <div className="h-px bg-white/20"></div>
                  <div className="flex justify-between items-center opacity-80">
                    <span className="text-[10px] font-bold uppercase">To Maintain Goal Weight:</span>
                    <span className="text-lg font-black">{Math.round(maintenanceAtGoal)} <small className="text-[10px] font-bold opacity-75">KCAL/DAY</small></span>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setView('log')} className="w-full bg-white border-4 border-blue-600 text-blue-600 py-5 rounded-[32px] font-black uppercase tracking-[0.2em] text-sm shadow-xl active:scale-[0.98] transition-all">
              Log Today's Weight
            </button>
          </div>
        )}

        {view === 'planner' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="flex justify-between items-center px-4 mb-4">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all ${
                    plannerStep === s ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-110' : 
                    plannerStep > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {s}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${plannerStep === s ? 'text-blue-600' : 'text-gray-400'}`}>
                    {s === 1 ? 'BIO' : s === 2 ? 'GOAL' : 'PLAN'}
                  </span>
                </div>
              ))}
            </div>

            {plannerStep === 1 && (
              <ProfileForm initialProfile={profile || undefined} onSubmit={handleProfileSubmit} hideAdvanced={!profile} />
            )}

            {plannerStep === 2 && (
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 space-y-6">
                <div className="text-center mb-2">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Set Your Target</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Step 2 of 3</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Target Weight ({profile?.units === 'metric' ? 'kg' : 'lbs'})</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-blue-500 focus:outline-none font-black text-xl text-center"
                      placeholder={`e.g. ${profile?.units === 'metric' ? '75.0' : '165.0'}`}
                      value={profile?.goalWeightKg ? toDisplayWeight(profile.goalWeightKg, profile.units).toFixed(1) : ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setProfile(prev => prev ? { ...prev, goalWeightKg: prev.units === 'metric' ? val : val / 2.20462 } : null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Days to Reach Goal</label>
                    <input
                      type="number"
                      className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-blue-500 focus:outline-none font-black text-xl text-center"
                      placeholder="e.g. 90"
                      value={profile?.goalDays || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, goalDays: parseInt(e.target.value) } : null)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setPlannerStep(1)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Back</button>
                  <button 
                    onClick={() => setPlannerStep(3)} 
                    disabled={!profile?.goalWeightKg || !profile?.goalDays}
                    className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 disabled:opacity-30 uppercase tracking-widest text-xs active:scale-95 transition-transform"
                  >
                    Calculate
                  </button>
                </div>
              </div>
            )}

            {plannerStep === 3 && profile && (
              <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-8 animate-in zoom-in-95 duration-500">
                <div className="text-center">
                  <div className="inline-block bg-blue-100 p-4 rounded-3xl mb-4">
                    <Calculator size={40} className="text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight tracking-tighter uppercase">Simulation<br/>Complete</h2>
                </div>

                <div className="space-y-4">
                  <div className="p-5 bg-gray-50 rounded-3xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Maintenance</p>
                    <p className="text-2xl font-black text-gray-800 tracking-tight">{Math.round(calculateMaintenanceCalories(profile, profile.initialWeightKg))} <span className="text-xs opacity-50 uppercase font-bold">kcal/day</span></p>
                  </div>
                  <div className="p-6 bg-blue-600 rounded-[32px] text-white shadow-xl shadow-blue-100 scale-105 transform">
                    <p className="text-[10px] font-black text-blue-100 uppercase tracking-[0.2em] mb-2">Target to Reach Goal</p>
                    <p className="text-4xl font-black tracking-tighter">{Math.round(goalCalories)} <span className="text-sm font-bold opacity-75 uppercase tracking-normal">kcal/day</span></p>
                  </div>
                  <div className="p-5 bg-green-50 rounded-3xl">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">To Maintain at Goal</p>
                    <p className="text-2xl font-black text-green-800 tracking-tight">{Math.round(maintenanceAtGoal)} <span className="text-xs opacity-50 uppercase font-bold">kcal/day</span></p>
                  </div>
                </div>

                <button 
                  onClick={() => { setView('dashboard'); setPlannerStep(1); }}
                  className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black shadow-2xl shadow-blue-200 uppercase tracking-[0.2em] active:scale-95 transition-all"
                >
                  Start My Plan
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'log' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <LogForm 
              day={logs.length > 0 ? Math.max(...logs.map(l => l.day)) + 1 : 0}
              units={profile?.units || 'metric'}
              initialLog={{ 
                day: logs.length > 0 ? Math.max(...logs.map(l => l.day)) + 1 : 0,
                weightKg: logs.length > 0 ? logs[logs.length-1].weightKg : profile?.initialWeightKg || 80,
                calories: goalCalories || profile?.initialCalories || 2000
              }}
              onSubmit={handleLogSubmit}
            />
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase tracking-widest border-b-4 border-blue-600 inline-block">History</h2>
            {logs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                <History size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No entries yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...logs].reverse().map(log => (
                  <div key={log.day} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex justify-between items-center group active:scale-95 transition-transform">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400 text-xs">
                        D{log.day}
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Weight</p>
                        <p className="font-black text-gray-900 text-lg">{toDisplayWeight(log.weightKg, profile?.units || 'metric').toFixed(1)} <span className="text-[10px] font-bold opacity-50 uppercase">{unitLabel}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Intake</p>
                      <p className="font-black text-blue-600 text-lg">{log.calories} <span className="text-[10px] font-bold opacity-50 uppercase">kcal</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'profile' && profile && (
          <div className="animate-in fade-in duration-500 pb-10 text-center">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-50 mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <User size={40} className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase mb-1">Your Bio</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Manage settings & units</p>
              <ProfileForm initialProfile={profile} onSubmit={handleProfileSubmit} />
            </div>
            <button 
              onClick={() => { if(confirm('Permanently delete all data?')) { localStorage.clear(); window.location.reload(); } }}
              className="py-4 text-red-500 font-black uppercase tracking-widest text-[10px] px-8 hover:bg-red-50 rounded-full transition-colors"
            >
              Reset Data & Profile
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-4 py-2 flex justify-around items-center z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <NavButton active={view === 'dashboard'} icon={Home} label="Home" onClick={() => setView('dashboard')} />
        <NavButton active={view === 'planner'} icon={Target} label="Plan" onClick={() => setView('planner')} />
        <div className="relative -top-7">
          <button onClick={() => setView('log')} className="bg-blue-600 text-white p-5 rounded-[2rem] shadow-2xl shadow-blue-400 active:scale-90 transition-all border-[6px] border-white group">
            <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
        <NavButton active={view === 'history'} icon={History} label="History" onClick={() => setView('history')} />
        <NavButton active={view === 'profile'} icon={User} label="Me" onClick={() => setView('profile')} />
      </nav>
    </div>
  );
}

export default App;
