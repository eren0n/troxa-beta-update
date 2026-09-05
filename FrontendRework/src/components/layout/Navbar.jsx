import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react';
import { Menu, X, ChevronRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Logo } from './Logo';

const navLinks = [
  { name: 'Product',   hash: 'product' },
  { name: 'Solutions', hash: 'solutions' },
  //{ name: 'Use Cases', hash: 'use-cases' },
  //{ name: 'Pricing',   hash: 'pricing' },
  { name: 'About',     hash: 'about' },
];

function smoothScrollTo(targetY, duration = 900) {
  const startY = window.scrollY;
  const diff = targetY - startY;
  let startTime = null;
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const step = (ts) => {
    if (!startTime) startTime = ts;
    const p = Math.min((ts - startTime) / duration, 1);
    window.scrollTo(0, startY + diff * ease(p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const location = useLocation();

  const { scrollY } = useScroll();
  const scrollSmooth = useSpring(scrollY, { stiffness: 70, damping: 18, restDelta: 0.001 });
  const glassOpacity = useTransform(scrollSmooth, [0, 90], [0, 1]);
  const logoScale   = useTransform(scrollSmooth, [0, 90], [1, 0.92]);

  /* â”€â”€ Active section tracking via IntersectionObserver â”€â”€ */
  useEffect(() => {
    if (location.pathname !== '/') return;

    const observers = [];
    navLinks.forEach(({ hash }) => {
      const el = document.getElementById(hash);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(hash); },
        { rootMargin: '-22% 0px -68% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [location.pathname]);

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const handleNavClick = (e, hash) => {
    e.preventDefault();
    setIsOpen(false);
    if (location.pathname !== '/') { window.location.href = `/#${hash}`; return; }
    const el = document.getElementById(hash);
    if (!el) return;
    smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - 80, 900);
    setActiveSection(hash);
  };

  return (
    <motion.nav className="fixed top-0 left-0 right-0 z-50">

      {/* â”€â”€ Liquid glass layer â”€â”€ */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ opacity: glassOpacity }}
      >
        {/* Frosted dark base */}
        <div className="absolute inset-0 bg-[#04060c]/55 backdrop-blur-2xl backdrop-saturate-150" />
        {/* Top edge shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/22 to-transparent" />
        {/* Subtle inner-light wash */}
        <div className="absolute inset-0 bg-linear-to-b from-white/3 via-transparent to-transparent" />
        {/* Bottom border */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>

      {/* â”€â”€ Content â”€â”€ */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <motion.div style={{ scale: logoScale }}>
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <Logo className="w-9 h-9 group-hover:drop-shadow-[0_0_14px_rgba(59,130,246,0.55)] transition-all duration-300" />
            <span className="text-xl font-black bg-clip-text text-transparent bg-linear-to-r from-white via-gray-100 to-gray-400 tracking-tight">
              Troxa.ai
            </span>
          </Link>
        </motion.div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map((link) => {
            const active = activeSection === link.hash;
            return (
              <a
                key={link.hash}
                href={`/#${link.hash}`}
                onClick={(e) => handleNavClick(e, link.hash)}
                className={`relative px-4 py-2 text-sm font-medium tracking-wide rounded-full transition-colors duration-200 ${
                  active ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-white/6 border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{link.name}</span>
              </a>
            );
          })}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="group px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-full transition-all shadow-[0_0_18px_rgba(37,99,235,0.35)] hover:shadow-[0_0_26px_rgba(37,99,235,0.55)] flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Get Started
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Mobile toggle */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          className="md:hidden w-10 h-10 flex items-center justify-center text-white rounded-xl bg-white/6 border border-white/10"
          onClick={() => setIsOpen(!isOpen)}
        >
          <AnimatePresence mode="wait">
            {isOpen
              ? <motion.span key="x"  initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.14 }}><X className="w-5 h-5" /></motion.span>
              : <motion.span key="m"  initial={{ rotate: 90, opacity: 0 }}  animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.14 }}><Menu className="w-5 h-5" /></motion.span>
            }
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1,  y: 0,   scale: 1 }}
            exit={{ opacity: 0,    y: -10,  scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="absolute top-full left-4 right-4 mt-2 bg-[#06090f]/88 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden md:hidden"
          >
            <div className="p-3 space-y-0.5">
              {navLinks.map((link, i) => {
                const active = activeSection === link.hash;
                return (
                  <motion.a
                    key={link.hash}
                    href={`/#${link.hash}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1,  x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={(e) => handleNavClick(e, link.hash)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'text-white bg-white/6 border border-white/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/4'
                    }`}
                  >
                    {link.name}
                    <ChevronRight className={`w-4 h-4 transition-colors ${active ? 'text-blue-400' : 'text-gray-700'}`} />
                  </motion.a>
                );
              })}
            </div>
            <div className="p-3 pt-0 space-y-2 border-t border-white/5">
              <Link to="/login" onClick={() => setIsOpen(false)} className="w-full py-3 border border-white/10 text-white rounded-xl flex items-center justify-center text-sm font-medium hover:bg-white/5 transition-all">
                Sign In
              </Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-lg shadow-blue-600/20">
                <Sparkles className="w-4 h-4" /> Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
