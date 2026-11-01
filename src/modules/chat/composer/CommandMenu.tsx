import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactElement } from 'react';
import { CornerDownLeft } from 'lucide-react';

import commandMarkUrl from '@/modules/chat/composer/command-mark.png';
import skillMarkUrl from '@/modules/chat/composer/skill-mark.png';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  ScrollArea,
} from '@/shared/ui';

type CommandMenuCommand = {
  name: string;
  description?: string;
  namespace?: string;
  path?: string;
  type?: string;
  metadata?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type CommandMenuProps = {
  commands?: CommandMenuCommand[];
  selectedIndex?: number;
  onSelect?: (command: CommandMenuCommand, index: number, isHover: boolean) => void;
  onClose: () => void;
  position?: { top: number; left: number; bottom?: number };
  isOpen?: boolean;
  frequentCommands?: CommandMenuCommand[];
  /** Renders in the plus menu instead of a portaled slash-command palette. */
  contained?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
};

type CommandMenuRow = {
  command: CommandMenuCommand;
  commandIndex: number;
  renderKey: string;
};

const menuBaseStyle: CSSProperties = {
  maxHeight: '360px',
  overflowY: 'auto',
  borderRadius: '8px',
  boxShadow: '0 24px 60px rgba(2, 6, 23, 0.38), 0 0 0 1px rgba(148, 163, 184, 0.12)',
  zIndex: 1000,
  padding: '4px',
  transition: 'opacity 150ms ease-in-out, transform 150ms ease-in-out',
  backdropFilter: 'blur(12px)',
};

const namespaceLabels: Record<string, string> = {
  frequent: 'Frequently Used',
  builtin: 'Built-in Commands',
  skill: 'Skills',
  project: 'Project Commands',
  user: 'User Commands',
  other: 'Other Commands',
};

const MENU_EDGE_GAP = 16;
const MENU_MAX_HEIGHT = 360;
const MENU_MIN_HEIGHT = 160;

const getCommandKey = (command: CommandMenuCommand) =>
  `${command.name}::${command.namespace || command.type || 'other'}::${command.path || ''}`;

const getNamespace = (command: CommandMenuCommand) => command.namespace || command.type || 'other';

/** Skills use the crossed-tools mark. Every other command uses the prompt mark. */
function CommandMenuMark({ command }: { command: CommandMenuCommand }) {
  const src = getNamespace(command) === 'skill' ? skillMarkUrl : commandMarkUrl;
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 bg-current text-muted-foreground"
      style={{
        maskImage: `url("${src}")`,
        WebkitMaskImage: `url("${src}")`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskMode: 'alpha',
      }}
    />
  );
}

function CommandMenuEntry({ command }: { command: CommandMenuCommand }) {
  return (
    <>
      <CommandMenuMark command={command} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate text-[13px] font-medium leading-4 text-foreground" title={command.name}>
            {command.name}
          </span>
          {command.metadata?.type && (
            <span className="shrink-0 rounded border border-border bg-muted px-px text-[9px] font-medium leading-none text-muted-foreground">
              {command.metadata.type}
            </span>
          )}
        </div>
        {command.description && (
          <div className="truncate text-[11px] leading-[13px] text-muted-foreground" title={command.description}>
            {command.description}
          </div>
        )}
      </div>
    </>
  );
}

const getMenuPosition = (position: { top: number; left: number; bottom?: number }): CSSProperties => {
  if (typeof window === 'undefined') {
    return { position: 'fixed', top: '16px', left: '16px' };
  }
  const maxAnchorBottom = Math.max(MENU_EDGE_GAP, window.innerHeight - MENU_EDGE_GAP - MENU_MIN_HEIGHT);
  if (window.innerWidth < 640) {
    const anchorBottom = Math.min(Math.max(MENU_EDGE_GAP, position.bottom ?? 90), maxAnchorBottom);
    return {
      position: 'fixed',
      bottom: `${anchorBottom}px`,
      left: '16px',
      right: '16px',
      width: 'auto',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: `min(54vh, calc(100vh - ${anchorBottom}px - ${MENU_EDGE_GAP}px))`,
    };
  }
  const anchorBottom = Math.min(Math.max(MENU_EDGE_GAP, position.bottom ?? 90), maxAnchorBottom);
  const clampedLeft = Math.max(
    MENU_EDGE_GAP,
    Math.min(position.left, window.innerWidth - 440 - MENU_EDGE_GAP),
  );

  return {
    position: 'fixed',
    bottom: `${anchorBottom}px`,
    left: `${clampedLeft}px`,
    width: 'min(440px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: `min(${MENU_MAX_HEIGHT}px, calc(100vh - ${anchorBottom}px - ${MENU_EDGE_GAP}px))`,
  };
};

/** Search field at the top of the plus menu's command list. Must render inside Command. */
function ContainedCommandSearch({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation('chat');
  const inputRef = useRef<HTMLInputElement>(null);
  const label = t('input.searchCommands', { defaultValue: 'Search commands' });

  useEffect(() => {
    // The menu item that opened this sheet is focused first, then unmounted.
    // Focus the search after that handoff so typing filters commands.
    const focusSearch = () => inputRef.current?.focus();
    const frame = window.requestAnimationFrame(focusSearch);
    const timer = window.setTimeout(focusSearch, 0);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <CommandInput
      ref={inputRef}
      value={query}
      onValueChange={onQueryChange}
      onPointerDown={(event) => event.stopPropagation()}
      placeholder={label}
      aria-label={label}
      containerClassName="border-b-0 px-2.5"
      className="h-8 py-1.5 text-[13px] font-sans"
    />
  );
}

/**
 * Rendered by chat's ChatComposer as the slash-command palette, and inside the
 * plus menu once Show all commands replaces the action list. Both scroll with
 * the overlay thumb so the native scrollbar does not take width from the rows.
 */
export default function CommandMenu({
  commands = [],
  selectedIndex = -1,
  onSelect,
  onClose,
  position = { top: 0, left: 0 },
  isOpen = false,
  frequentCommands = [],
  contained = false,
  query = '',
  onQueryChange,
}: CommandMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const menuPosition = getMenuPosition(position);

  useEffect(() => {
    if (!isOpen || contained) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current || !(event.target instanceof Node)) {
        return;
      }
      if (!menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contained, isOpen, onClose]);

  useEffect(() => {
    if (!selectedItemRef.current || !menuRef.current) {
      return;
    }
    const menuRect = menuRef.current.getBoundingClientRect();
    const itemRect = selectedItemRef.current.getBoundingClientRect();
    if (itemRect.bottom > menuRect.bottom || itemRect.top < menuRect.top) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) {
    return null;
  }

  const hasFrequentCommands = frequentCommands.length > 0;
  const frequentCommandKeys = new Set(frequentCommands.map(getCommandKey));
  const commandIndexesByKey = new Map<string, number[]>();
  commands.forEach((command, index) => {
    const key = getCommandKey(command);
    const commandIndexes = commandIndexesByKey.get(key) ?? [];
    commandIndexes.push(index);
    commandIndexesByKey.set(key, commandIndexes);
  });
  const frequentCommandOccurrences = new Map<string, number>();
  const getFrequentCommandIndex = (command: CommandMenuCommand): number => {
    const key = getCommandKey(command);
    const occurrence = frequentCommandOccurrences.get(key) ?? 0;
    frequentCommandOccurrences.set(key, occurrence + 1);

    const commandIndexes = commandIndexesByKey.get(key) ?? [];
    return commandIndexes[occurrence] ?? commandIndexes[0] ?? -1;
  };

  const groupedCommands = commands.reduce<Record<string, CommandMenuRow[]>>((groups, command, index) => {
    if (hasFrequentCommands && frequentCommandKeys.has(getCommandKey(command))) {
      return groups;
    }
    const namespace = getNamespace(command);
    if (!groups[namespace]) {
      groups[namespace] = [];
    }
    groups[namespace].push({
      command,
      commandIndex: index,
      renderKey: `${namespace}-${index}-${getCommandKey(command)}`,
    });
    return groups;
  }, {});
  if (hasFrequentCommands) {
    groupedCommands.frequent = frequentCommands
      .map((command, index) => {
        const commandIndex = getFrequentCommandIndex(command);
        return {
          command,
          commandIndex,
          renderKey: `frequent-${index}-${commandIndex}-${getCommandKey(command)}`,
        };
      })
      .filter((row) => row.commandIndex >= 0);
  }

  const preferredOrder = hasFrequentCommands
    ? ['frequent', 'builtin', 'skill', 'project', 'user', 'other']
    : ['builtin', 'skill', 'project', 'user', 'other'];
  const extraNamespaces = Object.keys(groupedCommands).filter((namespace) => !preferredOrder.includes(namespace));
  const orderedNamespaces = [...preferredOrder, ...extraNamespaces].filter((namespace) => groupedCommands[namespace]);
  const renderInPortal = (node: ReactElement) =>
    typeof document === 'undefined' ? node : createPortal(node, document.body);

  if (!contained && commands.length === 0) {
    return renderInPortal(
      <div
        ref={menuRef}
        className="command-menu command-menu-empty border border-border bg-popover/95 text-sm text-muted-foreground"
        style={{
          ...menuBaseStyle,
          ...menuPosition,
          overflowY: 'hidden',
          padding: '20px',
          opacity: 1,
          transform: 'translateY(0)',
          textAlign: 'center',
        }}
      >
        No commands available
      </div>
    );
  }

  const groups = commands.length === 0 ? (
    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
      {t('chat:input.noMatchingCommands', { defaultValue: 'No commands available' })}
    </div>
  ) : (
    orderedNamespaces.map((namespace) => (
        <div key={namespace} className="command-group">
          {orderedNamespaces.length > 1 && (
            <div className="flex items-center justify-between px-2 pb-0.5 pt-1.5 text-[11px] font-medium text-muted-foreground">
              <span>{namespaceLabels[namespace] || namespace}</span>
              <span className="rounded border border-border bg-muted px-1 py-px text-[10px] text-muted-foreground">
                {(groupedCommands[namespace] || []).length}
              </span>
            </div>
          )}

          {(groupedCommands[namespace] || []).map(({ command, commandIndex, renderKey }) => {
            const isSelected = commandIndex === selectedIndex;
            return (
              <div
                key={renderKey}
                ref={isSelected ? selectedItemRef : null}
                role="option"
                aria-selected={isSelected}
                className={`command-item group relative mb-0.5 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 font-sans transition-all ${
                  isSelected
                    ? 'border-primary/30 bg-primary/10 shadow-sm'
                    : 'border-transparent bg-transparent hover:border-border hover:bg-accent'
                }`}
                onMouseEnter={() => onSelect && commandIndex >= 0 && onSelect(command, commandIndex, true)}
                onClick={() => onSelect && commandIndex >= 0 && onSelect(command, commandIndex, false)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {isSelected && (
                  <span className="absolute bottom-1 left-1 top-1 w-0.5 rounded-full bg-primary" />
                )}
                <CommandMenuEntry command={command} />
                {isSelected && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-primary/30 bg-card text-primary shadow-sm">
                    <CornerDownLeft aria-hidden="true" size={12} strokeWidth={2.2} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))
  );

  if (contained) {
    return (
      <Command
        shouldFilter={false}
        label={t('chat:input.searchCommands', { defaultValue: 'Search commands' })}
        onKeyDown={(event) => {
          // Keep arrow keys and typing inside cmdk. Escape still bubbles so the dropdown closes.
          if (event.key !== 'Escape') {
            event.stopPropagation();
          }
        }}
        className="w-[min(22rem,calc(100vw-2rem))] font-sans text-popover-foreground"
      >
        {onQueryChange && <ContainedCommandSearch query={query} onQueryChange={onQueryChange} />}
        <ScrollArea
          overlayScrollbar
          className="w-full [&>div:first-child]:h-auto [&>div:first-child]:max-h-[min(20rem,calc(70vh-3rem))]"
        >
          <CommandList label={t('chat:misc.availableCommands')} className="max-h-none overflow-y-visible p-1 font-sans">
            <CommandEmpty>
              {t('chat:input.noMatchingCommands', { defaultValue: 'No commands available' })}
            </CommandEmpty>
            {commands.length > 0 && orderedNamespaces.map((namespace) => (
              <CommandGroup
                key={namespace}
                heading={orderedNamespaces.length > 1 ? (
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{namespaceLabels[namespace] || namespace}</span>
                    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {(groupedCommands[namespace] || []).length}
                    </span>
                  </span>
                ) : undefined}
                className="p-0.5 [&_[cmdk-group-heading]]:w-full [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium"
              >
                {(groupedCommands[namespace] || []).map(({ command, commandIndex, renderKey }) => (
                    <CommandItem
                      key={renderKey}
                      value={renderKey}
                      className="mb-0.5 items-center gap-2 rounded-md px-2 py-1 font-sans"
                      onMouseDown={(event) => event.preventDefault()}
                      onSelect={() => {
                        if (commandIndex < 0) {
                          return;
                        }
                        onSelect?.(command, commandIndex, false);
                      }}
                    >
                      <CommandMenuEntry command={command} />
                    </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </ScrollArea>
      </Command>
    );
  }

  const menuMaxHeight = typeof menuPosition.maxHeight === 'number'
    ? `${menuPosition.maxHeight}px`
    : menuPosition.maxHeight ?? `${MENU_MAX_HEIGHT}px`;
  // The 1px border sits outside the scrolling viewport under border-box sizing.
  const slashMenuScrollMaxHeight = `calc(${menuMaxHeight} - 2px)`;

  return renderInPortal(
    <div
      ref={menuRef}
      role="listbox"
      aria-label={t('chat:misc.availableCommands')}
      className="command-menu border border-border bg-popover/95 font-sans text-popover-foreground"
      style={{
        ...menuBaseStyle,
        ...menuPosition,
        overflowY: 'hidden',
        padding: 0,
        opacity: 1,
        transform: 'translateY(0)',
      }}
    >
      <ScrollArea
        overlayScrollbar
        className="w-full [&>div:first-child]:h-auto [&>div:first-child]:max-h-[var(--slash-menu-max-height)]"
        style={{ '--slash-menu-max-height': slashMenuScrollMaxHeight } as CSSProperties}
      >
        <div className="p-1">{groups}</div>
      </ScrollArea>
    </div>
  );
}
