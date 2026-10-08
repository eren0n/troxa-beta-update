import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, CreditCard, Plug } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import InlineRename from '../../components/dashboard/InlineRename';
import TeamPanel from './workspace/TeamPanel';
import BillingPanel from './workspace/BillingPanel';
import IntegrationsPanel from './workspace/IntegrationsPanel';

// Team, Billing, and Integrations used to be three separate routes/pages.
// They're merged here into one page with tabs — all three are "manage my
// workspace" concerns and didn't need their own nav real estate.
const TABS = [
  { id: 'team',         label: 'Team',         icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'billing',      label: 'Billing',      icon: CreditCard },
];

export default function WorkspaceManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === requested) ? requested : 'team'
  );

  const { activeWorkspace, isAdmin, renameWorkspace } = useAuth();

  const selectTab = (id) => {
    setActiveTab(id);
    setSearchParams(id === 'team' ? {} : { tab: id }, { replace: true });
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-black text-white">Workspace Management</h1>
        {activeWorkspace && (
          <div className="mt-2 max-w-md">
            {isAdmin ? (
              <InlineRename
                value={activeWorkspace.name}
                onSave={(name) => renameWorkspace(activeWorkspace.id, name)}
                textClassName="text-base font-black text-slate-200 truncate"
                inputClassName="flex-1 min-w-0 bg-black/40 border border-blue-500/50 rounded-lg px-2.5 py-1.5 text-sm font-black text-white outline-none"
              />
            ) : (
              <p className="text-base font-black text-slate-200 truncate">{activeWorkspace.name}</p>
            )}
          </div>
        )}
        <p className="text-slate-500 text-sm mt-1">Team, integrations and billing for your workspace — all in one place</p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-blue-500/10 border border-white/6 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`relative flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black transition-all ${
              activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="workspace-mgmt-tab" className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg" />
            )}
            <tab.icon className="relative z-10 w-3.5 h-3.5" />
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'team' && <TeamPanel />}
          {activeTab === 'integrations' && <IntegrationsPanel />}
          {activeTab === 'billing' && <BillingPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
