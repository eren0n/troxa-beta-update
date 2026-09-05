import { useParams, useNavigate } from 'react-router-dom';
import CreativeEditorPane from '../../components/dashboard/CreativeEditorPane';
import { GLASS_STYLE } from '../../components/ui/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';

// Route entry point for direct links (e.g. bookmarked /dashboard/editor/:id).
// The primary flow opens CreativeEditorPane in-place from the creatives
// grid instead — see EditCreative.jsx — so the clicked thumbnail grows into
// the canvas rather than navigating to a separate page.
export default function CreativeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { uiDesign, colorMode } = useTheme();

  return (
    <div
      className="min-h-screen flex items-stretch p-3 md:p-6"
      data-color-mode={colorMode}
      data-ui-design={uiDesign}
      style={{ background: 'var(--bg-page)' }}
    >
      <div className="flex-1 rounded-3xl overflow-hidden" style={{ ...GLASS_STYLE, height: 'calc(100vh - 24px)' }}>
        <CreativeEditorPane creativeId={id} onClose={() => navigate('/dashboard/gallery')} />
      </div>
    </div>
  );
}
