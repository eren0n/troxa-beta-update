import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PALETTE_ROLES } from '../lib/brandIdentity';
import { brandKitApi } from '../lib/api';
import { useAuth } from './AuthContext';

const BrandIdentityContext = createContext(null);

export function BrandIdentityProvider({ children }) {
  const { activeWorkspace } = useAuth();
  const [palettePresets, setPalettePresets] = useState([]);
  const [typographyPresets, setTypographyPresets] = useState([]);
  const colorDebounce = useRef({});

  useEffect(() => {
    if (!activeWorkspace) return;
    Promise.allSettled([
      brandKitApi.palettePresets(),
      brandKitApi.typographyPresets(),
    ]).then(([palRes, typRes]) => {
      if (palRes.status === 'fulfilled') setPalettePresets(palRes.value);
      if (typRes.status === 'fulfilled') setTypographyPresets(typRes.value);
    });
  }, [activeWorkspace]);

  // --- Palette ---

  const addPalettePreset = async () => {
    const defaultColors = [
      { id: crypto.randomUUID(), hex: '#3b82f6', role: 'primary' },
      { id: crypto.randomUUID(), hex: '#0f172a', role: 'secondary' },
      { id: crypto.randomUUID(), hex: '#f97316', role: 'accent' },
      { id: crypto.randomUUID(), hex: '#e2e8f0', role: 'neutral' },
    ];
    try {
      const created = await brandKitApi.createPalettePreset({
        name: `Palette ${palettePresets.length + 1}`,
        colors: defaultColors,
      });
      setPalettePresets((prev) => [...prev, created]);
      return created.id;
    } catch {}
  };

  const removePalettePreset = (id) => {
    setPalettePresets((prev) => prev.filter((p) => p.id !== id));
    brandKitApi.deletePalettePreset(id).catch(() => {});
  };

  const toggleActivePalettePreset = (id) => {
    setPalettePresets((prev) => {
      const current = prev.find((p) => p.id === id);
      const nextActive = current ? !current.active : false;
      brandKitApi.updatePalettePreset(id, { active: nextActive }).catch(() => {});
      return prev.map((p) => ({ ...p, active: p.id === id ? nextActive : false }));
    });
  };

  const renamePalettePreset = (id, name) => {
    if (!name.trim()) return;
    setPalettePresets((prev) => prev.map((p) => p.id === id ? { ...p, name: name.trim() } : p));
    brandKitApi.updatePalettePreset(id, { name: name.trim() }).catch(() => {});
  };

  const setColorRole = (presetId, colorId, role) => {
    setPalettePresets((prev) => {
      const next = prev.map((p) => {
        if (p.id !== presetId) return p;
        return {
          ...p, colors: p.colors.map((c) => {
            if (c.id === colorId) return { ...c, role };
            if (c.role === role) return { ...c, role: 'neutral' };
            return c;
          }),
        };
      });
      const updated = next.find((p) => p.id === presetId);
      if (updated) brandKitApi.updatePalettePreset(presetId, { colors: updated.colors }).catch(() => {});
      return next;
    });
  };

  const setColorHex = (presetId, colorId, hex) => {
    setPalettePresets((prev) => prev.map((p) =>
      p.id === presetId ? { ...p, colors: p.colors.map((c) => c.id === colorId ? { ...c, hex } : c) } : p
    ));
    clearTimeout(colorDebounce.current[presetId]);
    colorDebounce.current[presetId] = setTimeout(() => {
      setPalettePresets((prev) => {
        const p = prev.find((x) => x.id === presetId);
        if (p) brandKitApi.updatePalettePreset(presetId, { colors: p.colors }).catch(() => {});
        return prev;
      });
    }, 600);
  };

  const removeColor = (presetId, colorId) => {
    setPalettePresets((prev) => {
      const next = prev.map((p) =>
        p.id === presetId ? { ...p, colors: p.colors.filter((c) => c.id !== colorId) } : p
      );
      const updated = next.find((p) => p.id === presetId);
      if (updated) brandKitApi.updatePalettePreset(presetId, { colors: updated.colors }).catch(() => {});
      return next;
    });
  };

  const addColor = (presetId) => {
    setPalettePresets((prev) => {
      const next = prev.map((p) => {
        if (p.id !== presetId) return p;
        const usedRoles = new Set(p.colors.map((c) => c.role));
        const nextRole = PALETTE_ROLES.find((r) => !usedRoles.has(r.key))?.key || 'neutral';
        return { ...p, colors: [...p.colors, { id: crypto.randomUUID(), hex: '#94a3b8', role: nextRole }] };
      });
      const updated = next.find((p) => p.id === presetId);
      if (updated) brandKitApi.updatePalettePreset(presetId, { colors: updated.colors }).catch(() => {});
      return next;
    });
  };

  // --- Typography ---

  const addTypographyPreset = async () => {
    try {
      const created = await brandKitApi.createTypographyPreset({
        name: `Typography ${typographyPresets.length + 1}`,
        heading: 'Inter',
        body: 'Inter',
      });
      setTypographyPresets((prev) => [...prev, created]);
      return created.id;
    } catch {}
  };

  const removeTypographyPreset = (id) => {
    setTypographyPresets((prev) => prev.filter((t) => t.id !== id));
    brandKitApi.deleteTypographyPreset(id).catch(() => {});
  };

  const toggleActiveTypographyPreset = (id) => {
    setTypographyPresets((prev) => {
      const current = prev.find((t) => t.id === id);
      const nextActive = current ? !current.active : false;
      brandKitApi.updateTypographyPreset(id, { active: nextActive }).catch(() => {});
      return prev.map((t) => ({ ...t, active: t.id === id ? nextActive : false }));
    });
  };

  const renameTypographyPreset = (id, name) => {
    if (!name.trim()) return;
    setTypographyPresets((prev) => prev.map((t) => t.id === id ? { ...t, name: name.trim() } : t));
    brandKitApi.updateTypographyPreset(id, { name: name.trim() }).catch(() => {});
  };

  const setTypographyFont = (id, key, font) => {
    setTypographyPresets((prev) => prev.map((t) => t.id === id ? { ...t, [key]: font } : t));
    brandKitApi.updateTypographyPreset(id, { [key]: font }).catch(() => {});
  };

  return (
    <BrandIdentityContext.Provider value={{
      palettePresets, addPalettePreset, removePalettePreset, toggleActivePalettePreset, renamePalettePreset,
      setColorRole, setColorHex, removeColor, addColor,
      typographyPresets, addTypographyPreset, removeTypographyPreset, toggleActiveTypographyPreset, renameTypographyPreset,
      setTypographyFont,
    }}>
      {children}
    </BrandIdentityContext.Provider>
  );
}

export const useBrandIdentity = () => useContext(BrandIdentityContext);
