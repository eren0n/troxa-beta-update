import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LockedFeature({ feature }) {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-[60vh] flex items-center justify-center">
      <div className="absolute inset-0 bg-[#080b15]/70 backdrop-blur-sm rounded-2xl z-10 pointer-events-none" />
      <div className="relative z-20 flex flex-col items-center text-center px-6 py-16 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
          <Lock className="w-7 h-7 text-blue-400" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">{feature} is a paid feature</h2>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          Upgrade your plan to unlock {feature}, along with more generations, team seats, and advanced tools.
        </p>
        <button
          onClick={() => navigate('/dashboard/billing')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Upgrade Plan
        </button>
      </div>
    </div>
  );
}
