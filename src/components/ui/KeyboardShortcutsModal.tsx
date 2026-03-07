import React, { useEffect } from "react";
import { X, Keyboard } from "lucide-react";

type KeyboardShortcutsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const shortcuts = [
  { action: "Open Project", keys: ["Ctrl", "O"] },
  { action: "Save Project", keys: ["Ctrl", "S"] },
  { action: "Export Waypoints", keys: ["Ctrl", "E"] },
  { action: "Select All Nodes", keys: ["Ctrl", "A"] },
  { action: "Delete Selected", keys: ["Delete", "or", "Backspace"] },
  { action: "Deselect / Cancel", keys: ["Esc"] },
  { action: "Pan Map", keys: ["Left Mouse Drag"] },
  { action: "Zoom Map", keys: ["Scroll Wheel"] },
  { action: "Select Node", keys: ["Left Click"] },
  { action: "Select Multiple", keys: ["Shift", "+", "Left Click"] },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-slate-700 w-[500px] max-w-[90vw] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3 text-slate-100 font-semibold text-lg">
            <Keyboard size={20} className="text-primary" />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
          <div className="grid grid-cols-1 gap-3">
            {shortcuts.map((shortcut, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 px-3 rounded transition-colors">
                <span className="text-slate-300 font-medium text-[14px]">{shortcut.action}</span>
                <div className="flex items-center gap-1.5">
                  {shortcut.keys.map((key, keyIdx) => (
                    <React.Fragment key={keyIdx}>
                      {key === "or" || key === "+" ? (
                        <span className="text-slate-500 text-[12px]">{key}</span>
                      ) : (
                        <kbd className="bg-slate-800 border-b-2 border-slate-950 px-2.5 py-1 rounded text-slate-200 text-[12px] font-mono shadow-sm">
                          {key}
                        </kbd>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="ui-btn-primary px-6 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
