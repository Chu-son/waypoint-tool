import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../utils/cn';
import { useClickOutside } from '../../../hooks/useClickOutside';

/**
 * Right-click menu shown at a fixed screen position. Closes when the user presses outside it.
 *
 *   {menu && (
 *     <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
 *       <ContextMenuItem icon={<Copy size={13} />} onSelect={copy}>Copy</ContextMenuItem>
 *       <ContextMenuSeparator />
 *       <ContextMenuItem tone="danger" onSelect={remove}>Delete</ContextMenuItem>
 *     </ContextMenu>
 *   )}
 *
 * Items call `onClose` after their `onSelect` runs.
 */
const ContextMenuCloseContext = React.createContext<() => void>(() => {});

export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose, className, children, style, ...props }: ContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  return (
    <ContextMenuCloseContext.Provider value={onClose}>
      <div
        ref={ref}
        role="menu"
        style={{ top: y, left: x, ...style }}
        className={cn(
          'fixed z-[9999] bg-surface-panel border border-border-base rounded-xl shadow-xl py-1 min-w-[190px] text-xs text-text-base select-none backdrop-blur-md flex flex-col gap-0.5',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ContextMenuCloseContext.Provider>
  );
}

const itemVariants = cva('flex items-center gap-2 px-3 py-1.5 rounded text-left w-full transition-colors', {
  variants: {
    tone: {
      default: 'hover:bg-surface-hover text-text-base',
      danger: 'hover:bg-danger-base/10 text-danger-base',
    },
    emphasis: {
      normal: '',
      strong: 'font-medium',
    },
  },
  defaultVariants: { tone: 'default', emphasis: 'normal' },
});

export interface ContextMenuItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'>, VariantProps<typeof itemVariants> {
  icon?: React.ReactNode;
  onSelect: () => void;
}

export function ContextMenuItem({
  icon,
  onSelect,
  tone,
  emphasis,
  className,
  children,
  ...props
}: ContextMenuItemProps) {
  const close = React.useContext(ContextMenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onSelect();
        close();
      }}
      className={cn(itemVariants({ tone, emphasis }), className)}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div role="separator" className="h-px bg-border-base/30 my-0.5" />;
}
