import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const GO_MAP: Record<string, string> = {
  d: "/dashboard", n: "/new-patient", p: "/patients",
  t: "/test-master", r: "/doctors", b: "/reports", s: "/settings",
};

/** Global hotkeys (§7D.4 / §13): Ctrl+N new patient, Ctrl+K / Ctrl+F command palette,
 *  and vim-style "g <key>" navigation. Ignores typing inside inputs (except the Ctrl combos). */
export function KeyboardShortcuts({ onOpenPalette }: { onOpenPalette: () => void }) {
  const navigate = useNavigate();
  const lastG = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault(); onOpenPalette(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault(); navigate('/new-patient'); return;
      }
      if (typing) return;

      if (e.key === 'g') { lastG.current = Date.now(); return; }
      if (Date.now() - lastG.current < 800 && GO_MAP[e.key]) {
        e.preventDefault(); navigate(GO_MAP[e.key]); lastG.current = 0;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, onOpenPalette]);

  return null;
}
