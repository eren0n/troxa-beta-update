import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { creativesApi } from '../lib/api';

const GenerationContext = createContext(null);

export function GenerationProvider({ children }) {
  const [activeJobs, setActiveJobs] = useState([]);
  const pollingRef = useRef(null);

  const jobsKey = activeJobs.map(j => `${j.id}:${j.status}`).join(',');

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const allSettled = activeJobs.every(j => j.status === 'done' || j.status === 'error');
    if (allSettled) return;

    const id = setInterval(async () => {
      const pending = activeJobs.filter(j => j.status !== 'done' && j.status !== 'error');
      const results = await Promise.allSettled(pending.map(j => creativesApi.jobStatus(j.id)));
      setActiveJobs(prev => {
        const next = [...prev];
        results.forEach(r => {
          if (r.status === 'fulfilled') {
            const idx = next.findIndex(j => j.id === r.value.id);
            if (idx !== -1) next[idx] = r.value;
          }
        });
        return next;
      });
    }, 2500);
    pollingRef.current = id;
    return () => clearInterval(id);
  }, [jobsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearJobs = useCallback(() => {
    clearInterval(pollingRef.current);
    setActiveJobs([]);
  }, []);

  const pendingCount = activeJobs.filter(j => j.status !== 'done' && j.status !== 'error').length;
  const allSettled = activeJobs.length > 0 && activeJobs.every(j => j.status === 'done' || j.status === 'error');

  return (
    <GenerationContext.Provider value={{ activeJobs, setActiveJobs, clearJobs, pendingCount, allSettled }}>
      {children}
    </GenerationContext.Provider>
  );
}

export const useGeneration = () => useContext(GenerationContext);
