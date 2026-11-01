import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, MoreHorizontal, type LucideIcon } from 'lucide-react';

import { cn } from '@/shared/utils';
import { Button } from '@/shared/ui/Button';

type ActionMenuControls = {
  isOpen: boolean;
  /** Opens or closes the menu, anchoring it to the element that was clicked. */
  toggleFrom: (anchor: HTMLElement, focusMenu: boolean) => void;
};

const ActionMenuContext = React.createContext<ActionMenuControls | null>(null);

type ActionMenuButtonProps = {
  label: string;
  className?: string;
};

/**
 * Opens the ActionMenu that wraps it. Sidebar project and session rows use it so
 * the "…" control opens the same menu as a right-click on the row.
 */
export function ActionMenuButton({ label, className }: ActionMenuButtonProps) {
  const menu = React.useContext(ActionMenuContext);
  if (!menu) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-action-menu-button=""
      className={cn(className, menu.isOpen && 'pointer-events-auto opacity-100')}
      title={label}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={menu.isOpen}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.toggleFrom(event.currentTarget, event.detail === 0);
      }}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
}

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export type ActionMenuItem = {
  key: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  loading?: boolean;
  isDanger?: boolean;
  showDividerBefore?: boolean;
  closeOnSelect?: boolean;
};

type ActionMenuProps = {
  label: string;
  items: ActionMenuItem[];
  icon?: LucideIcon;
  ariaLabel?: string;
  align?: 'left' | 'right';
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  iconOnly?: boolean;
  portal?: boolean;
  header?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  /**
   * Smaller type, icons, and padding. The sidebar project and session menus
   * use this so a right-click stays compact beside the row.
   */
  compact?: boolean;
  /**
   * `context` opens the menu from a right-click (or the context-menu key) on
   * `children` and omits the button. `button` is the overflow trigger.
   */
  trigger?: 'button' | 'context';
  children?: React.ReactNode;
};

/** Used by the mcp and sidebar modules for an overflow button or a right-click menu on a row. */
export function ActionMenu({
  label,
  items,
  icon: TriggerIcon,
  ariaLabel,
  align = 'right',
  variant = 'outline',
  size = 'sm',
  className,
  triggerClassName,
  menuClassName,
  disabled,
  iconOnly = false,
  portal = false,
  header,
  onOpenChange,
  compact = false,
  trigger = 'button',
  children,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [portalPosition, setPortalPosition] = React.useState<{ top: number; left: number } | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  // Whether closing should move focus back to the trigger. Set for keyboard
  // (Escape) and item selection, but left false for outside pointer clicks so
  // focus is not stolen from wherever the user clicked.
  const restoreFocusRef = React.useRef(false);
  const focusMenuOnOpenRef = React.useRef(false);
  const wasOpenRef = React.useRef(false);
  const menuId = React.useId();
  const usePortal = portal || trigger === 'context';

  const setMenuOpen = React.useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPortalPosition(null);
    }
    onOpenChange?.(open);
  }, [onOpenChange]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }

      // A right-click on this same row repositions the menu. A left-click on a
      // button trigger is the toggle, so that stays open until click runs.
      const insideTrigger = rootRef.current?.contains(target) ?? false;
      // The "…" button toggles on click. Letting this mousedown close the menu
      // first would reopen it on the click that follows.
      const menuButton = target instanceof Element
        ? target.closest('[data-action-menu-button]')
        : null;
      if (menuButton && rootRef.current?.contains(menuButton)) {
        return;
      }
      if (event.button === 2 && trigger === 'context' && insideTrigger) {
        return;
      }
      if (trigger !== 'context' && insideTrigger) {
        return;
      }

      setMenuOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        restoreFocusRef.current = true;
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, setMenuOpen, trigger]);

  React.useEffect(() => {
    if (!isOpen || !usePortal) {
      return;
    }

    const closeOnViewportChange = () => setMenuOpen(false);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [isOpen, usePortal, setMenuOpen]);

  // Move focus into the menu on open and back to the trigger on a keyboard or
  // selection close, so keyboard and screen-reader navigation match the menu role.
  React.useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      if (focusMenuOnOpenRef.current) {
        const menu = menuRef.current;
        const firstItem = menu?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
        (firstItem ?? menu)?.focus();
      }
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (restoreFocusRef.current) {
        triggerRef.current?.focus();
      }
      restoreFocusRef.current = false;
    }
  }, [isOpen]);

  const runItem = (item: ActionMenuItem) => {
    if (item.disabled || item.loading) {
      return;
    }

    if (item.closeOnSelect !== false) {
      restoreFocusRef.current = true;
      setMenuOpen(false);
    }
    item.onSelect();
  };

  const menuHeight = () => {
    const headerHeight = header ? (compact ? 56 : 72) : 0;
    const rowHeight = (item: ActionMenuItem) =>
      (item.description ? (compact ? 44 : 58) : (compact ? 32 : 40))
      + (item.showDividerBefore ? 9 : 0);
    return headerHeight + items.reduce((height, item) => height + rowHeight(item), compact ? 8 : 12);
  };

  const placeMenu = (clientX: number, clientY: number, focusMenu: boolean) => {
    const menuWidth = 260;
    const estimatedHeight = menuHeight();
    setPortalPosition({
      top: clientY + estimatedHeight <= window.innerHeight - 8
        ? clientY
        : Math.max(8, window.innerHeight - estimatedHeight - 8),
      left: Math.max(8, Math.min(clientX, window.innerWidth - menuWidth - 8)),
    });
    focusMenuOnOpenRef.current = focusMenu;
    // A second right-click only moves the menu. Opening again would notify
    // onOpenChange and refetch whatever the caller loads on open.
    if (!isOpen) {
      setMenuOpen(true);
    }
  };

  const toggleFrom = (anchor: HTMLElement, focusMenu: boolean) => {
    if (disabled) {
      return;
    }
    if (isOpen) {
      setMenuOpen(false);
      return;
    }

    triggerRef.current = anchor as HTMLButtonElement;
    focusMenuOnOpenRef.current = focusMenu;
    if (usePortal) {
      const rect = anchor.getBoundingClientRect();
      const menuWidth = 260;
      const estimatedHeight = menuHeight();
      setPortalPosition({
        top: rect.bottom + 6 + estimatedHeight <= window.innerHeight - 8
          ? rect.bottom + 6
          : Math.max(8, rect.top - estimatedHeight - 6),
        left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
      });
    }
    setMenuOpen(true);
  };

  const toggleMenu = () => {
    if (!triggerRef.current) {
      setMenuOpen(!isOpen);
      return;
    }
    toggleFrom(triggerRef.current, focusMenuOnOpenRef.current);
  };

  const openContextMenu = (event: React.MouseEvent) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    placeMenu(event.clientX, event.clientY, false);
  };

  const openContextMenuFromKeyboard = (event: React.KeyboardEvent) => {
    if (disabled || (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    placeMenu(rect.left, rect.bottom + 4, true);
  };

  const menu = isOpen && (!usePortal || portalPosition) && (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={ariaLabel || label}
      tabIndex={-1}
      data-escape-layer
      className={cn(
        usePortal ? 'fixed z-[70]' : 'absolute top-full z-50 mt-2',
        'min-w-[220px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
        !usePortal && (align === 'right' ? 'right-0' : 'left-0'),
        menuClassName,
      )}
      style={usePortal && portalPosition ? portalPosition : undefined}
    >
      {header}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <React.Fragment key={item.key}>
            {item.showDividerBefore && <div className="mx-2 my-1 h-px bg-border" />}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled || item.loading}
              onClick={() => runItem(item)}
              className={cn(
                'flex w-full items-start rounded-md text-left transition-colors',
                'focus:outline-none focus-visible:bg-accent',
                compact ? 'gap-2 px-2.5 py-1.5 text-xs' : 'gap-3 px-3 py-2 text-sm',
                item.disabled || item.loading
                  ? 'cursor-not-allowed opacity-50'
                  : item.isDanger
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
                    : 'hover:bg-accent',
              )}
            >
              {item.loading ? (
                <Loader2 className={cn('flex-shrink-0 animate-spin', compact ? 'mt-px h-3.5 w-3.5' : 'mt-0.5 h-4 w-4')} />
              ) : (
                Icon && <Icon className={cn('flex-shrink-0', compact ? 'mt-px h-3.5 w-3.5' : 'mt-0.5 h-4 w-4')} />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block font-medium', compact ? 'leading-4' : 'leading-5')}>{item.label}</span>
                {item.description && (
                  <span className={cn(
                    'mt-0.5 block text-muted-foreground',
                    compact ? 'text-[10px] leading-3' : 'text-xs leading-4',
                  )}>
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <ActionMenuContext.Provider value={{ isOpen, toggleFrom }}>
    <div
      ref={rootRef}
      className={cn(trigger === 'context' ? 'relative block w-full' : 'relative inline-flex', className)}
      onContextMenu={trigger === 'context' ? openContextMenu : undefined}
      onKeyDown={trigger === 'context' ? openContextMenuFromKeyboard : undefined}
    >
      {trigger === 'context' ? children : (
        <Button
          ref={triggerRef}
          type="button"
          variant={variant}
          size={size}
          className={triggerClassName}
          disabled={disabled}
          aria-label={ariaLabel || label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          onClick={(event) => {
            focusMenuOnOpenRef.current = event.detail === 0;
            toggleMenu();
          }}
        >
          {TriggerIcon && <TriggerIcon className="h-4 w-4" />}
          {!iconOnly && (
            <>
              <span>{label}</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </>
          )}
        </Button>
      )}

      {usePortal && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
    </ActionMenuContext.Provider>
  );
}
