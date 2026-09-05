import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Twitter, Linkedin, Github, ArrowRight, Shield, Zap, Globe, Mail } from 'lucide-react';
import { Logo } from './Logo';

const footerLinks = {
  Product: [
    { label: 'Platform Overview', path: '/#product' },
    { label: 'Solutions', path: '/#solutions' },
    { label: 'Use Cases', path: '/#use-cases' },
    { label: 'Automation', path: '/dashboard/automation' },
  ],
  Company: [
    { label: 'About Us', path: '/#about' },
    { label: 'Sign Up', path: '/signup' },
    { label: 'Privacy Policy', path: '#' },
    { label: 'Terms of Service', path: '#' },
    { label: 'Cookie Policy', path: '#' },
  ],
  Platform: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Creative Generator', path: '/dashboard/create' },
    { label: 'Brand Kit', path: '/dashboard/brand-kit' },
    { label: 'Team Workspace', path: '/dashboard/workspace?tab=team' },
    { label: 'API Documentation', path: '#' },
  ],
};

const trustBadges = [
  { icon: Shield, label: 'SOC 2 Compliant' },
  { icon: Zap, label: 'US-50 Certified' },
  { icon: Globe, label: 'GDPR Ready' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#05070d] border-t border-white/6 relative overflow-hidden">
      {/* Subtle gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-px bg-linear-to-r from-transparent via-blue-500/30 to-transparent" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/3 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pt-20 pb-16">
          {/* Brand col */}
          <div className="lg:col-span-2 space-y-8">
            <Link to="/" className="flex items-center gap-3 group w-fit">
              <Logo className="w-9 h-9 group-hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.5)] transition-all duration-300" />
              <span className="text-xl font-black text-white tracking-tight">Troxa.ai</span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              AI-powered creative engine built exclusively for licensed iGaming brands. Generate. Comply. Win.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2">
              {trustBadges.map((b) => (
                <div key={b.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/4 border border-white/6 rounded-lg">
                  <b.icon className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{b.label}</span>
                </div>
              ))}
            </div>

            {/* Socials */}
            <div className="flex items-center gap-3">
              {[
                { icon: Twitter, label: 'Twitter' },
                { icon: Linkedin, label: 'LinkedIn' },
                { icon: Github, label: 'GitHub' },
                { icon: Mail, label: 'Email' },
              ].map(({ icon: Icon, label }) => (
                <motion.a
                  key={label}
                  href="#"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-blue-600 border border-white/6 hover:border-blue-600 rounded-xl text-slate-500 hover:text-white transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="space-y-6">
              <h4 className="text-xs font-black text-white uppercase tracking-[0.15em]">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-sm text-slate-500 hover:text-blue-400 transition-colors duration-200 flex items-center gap-1 group"
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter CTA */}
        <div className="py-10 border-t border-b border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h5 className="font-black text-white text-lg">Stay ahead of the creative curve</h5>
              <p className="text-slate-500 text-sm mt-1">Platform updates, iGaming industry insights, and AI creative tips.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                placeholder="your@company.com"
                className="flex-1 md:w-64 bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors shrink-0 flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                Subscribe <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Compliance strip 
        <div className="py-6 bg-red-500/3 -mx-6 px-6 border-b border-white/5">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full border-2 border-red-500/60 flex items-center justify-center text-[10px] font-black text-red-500">18+</div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Responsible Gaming</span>
            </div>
            <p className="text-[10px] text-slate-700 leading-relaxed">
              Troxa.ai provides AI creative generation tools only. We do not operate gambling services. Our tools are intended exclusively for use by licensed professional iGaming marketing teams and operators across all 50 US states. All creatives must be reviewed by your compliance team before live deployment.
            </p>
          </div>
        </div>*/}

        {/* Copyright */}
        <div className="py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-700">Â© {year} Troxa.ai. All rights reserved.</p>
          <div className="flex items-center gap-6 text-[10px] text-slate-700">
            <span className="font-mono uppercase tracking-widest">B2B TECHNOLOGY PLATFORM</span>
            <span>Â·</span>
            <span>Not a gambling operator</span>
            <span>Â·</span>
            <span>US Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
