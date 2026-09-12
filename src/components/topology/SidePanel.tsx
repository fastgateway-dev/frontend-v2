import { useEffect } from 'react';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function SidePanel({ open, onClose, title, children }: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        data-testid="sidepanel-backdrop"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-[480px] bg-background shadow-xl border-l overflow-y-auto">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button aria-label="Close panel" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </header>
        <div className="p-4 text-sm">{children}</div>
      </aside>
    </div>
  );
}
