import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Mail, Shield, ArrowRight } from 'lucide-react';
import { Logo } from '../components/layout/Logo';

export default function SignUp() {
  return (
    <div className="min-h-screen bg-[#05070d] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center space-y-8"
      >
        <Link to="/" className="inline-flex items-center gap-3 justify-center">
          <Logo className="w-10 h-10" />
          <span className="text-2xl font-black text-white">Troxa.ai</span>
        </Link>

        <div className="p-8 bg-[#0c0f1a] border border-white/8 rounded-2xl space-y-6">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-blue-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Closed Beta</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Troxa.ai is currently invite-only. We're onboarding a limited number of iGaming operators during this phase.
            </p>
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-3">
            <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Request Access</p>
            <p className="text-slate-400 text-sm">
              Reach out to us and we'll get you set up.
            </p>
            <a
              href="mailto:info@rmgs.online?subject=Troxa.ai Beta Access Request"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
            >
              <Mail className="w-4 h-4" />
              info@rmgs.online
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-700">
            <Shield className="w-3.5 h-3.5" />
            <span>B2B · iGaming Operators Only</span>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 font-bold hover:text-blue-300 transition-colors">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
