import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext(null);

const LS_DESIGN = 'troxa_ui_design';
const LS_COLOR  = 'troxa_color_mode';

// Color-mode/UI-design attributes are applied by DashboardLayout on its own
// root element (not <html>) so they only affect the dashboard subtree —
// marketing/login/signup pages stay permanently dark regardless of what
// the user picked for their dashboard. See DashboardLayout.jsx and the
// `[data-color-mode]` selectors in index.css (not `html[data-color-mode]`).
export function ThemeProvider({ children }) {
  const [uiDesign,  setUiDesignState]  = useState(() => localStorage.getItem(LS_DESIGN));
  const [colorMode, setColorModeState] = useState(() => localStorage.getItem(LS_COLOR));

  const setUiDesign = (design) => {
    localStorage.setItem(LS_DESIGN, design);
    setUiDesignState(design);
  };

  const setColorMode = (mode) => {
    localStorage.setItem(LS_COLOR, mode);
    setColorModeState(mode);
  };

  // true once both preferences have been explicitly saved
  const isSetupComplete = uiDesign !== null && colorMode !== null;

  return (
    <ThemeContext.Provider value={{
      uiDesign:       uiDesign  || 'rework',
      colorMode:      colorMode || 'dark',
      isSetupComplete,
      setUiDesign,
      setColorMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
