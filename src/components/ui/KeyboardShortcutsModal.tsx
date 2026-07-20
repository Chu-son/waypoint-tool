import React, { useEffect } from "react";
import { Keyboard } from "lucide-react";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "./common/Modal";
import { Button } from "./common/Button";

type KeyboardShortcutsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const shortcuts = [
  { action: "New Project", keys: ["Ctrl", "N"] },
  { action: "Open Project", keys: ["Ctrl", "O"] },
  { action: "Save Project", keys: ["Ctrl", "S"] },
  { action: "Export Waypoints", keys: ["Ctrl", "E"] },
  { action: "Select All Nodes", keys: ["Ctrl", "A"] },
  { action: "Delete Selected", keys: ["Delete", "or", "Backspace"] },
  { action: "Deselect / Cancel", keys: ["Esc"] },
  { action: "Select Tool", keys: ["V"] },
  { action: "Add Waypoint Tool", keys: ["P"] },
  { action: "Cycle Snap Base Node (Add Mode)", keys: ["Tab"] },
  { action: "Distance Input (Add Mode)", keys: ["0", "-", "9", ".", "-"] },
  { action: "Confirm Snapped Waypoint (Add Mode)", keys: ["Enter"] },
  { action: "Force Axis Snap X/Y (Add Mode)", keys: ["↑", "↓", "←", "→"] },
  { action: "Pan Map", keys: ["Left Mouse Drag"] },
  { action: "Zoom Map", keys: ["Scroll Wheel"] },
  { action: "Fit Map to Screen", keys: ["Middle Double Click"] },
  { action: "Select Node", keys: ["Left Click"] },
  { action: "Select Multiple", keys: ["Shift", "+", "Left Click"] },
  { action: "Set / Clear Anchor", keys: ["Right Click Node"] },
  { action: "Copy Transform Element", keys: ["Right Click Label"] },
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <Keyboard size={20} className="text-primary-base" />
          <span>Keyboard Shortcuts</span>
        </div>
      </ModalHeader>
      
      <ModalContent className="p-0">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3">
            {shortcuts.map((shortcut, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5 border-b border-border-base/30 last:border-0 hover:bg-surface-hover/50 px-3 rounded-lg transition-colors">
                <span className="text-text-base font-medium text-[14px]">{shortcut.action}</span>
                <div className="flex items-center gap-1.5">
                  {shortcut.keys.map((key, keyIdx) => (
                    <React.Fragment key={keyIdx}>
                      {key === "or" || key === "+" ? (
                        <span className="text-text-muted text-[12px] font-medium">{key}</span>
                      ) : (
                        <kbd className="bg-surface-base border-b-2 border-slate-950 px-2.5 py-1 rounded-md text-text-base text-[12px] font-mono shadow-sm">
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
      </ModalContent>

      <ModalFooter>
        <Button onClick={onClose} className="px-8">
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
