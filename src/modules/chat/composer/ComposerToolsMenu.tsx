import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareIcon, PaperclipIcon, PlusIcon } from 'lucide-react';

import CommandMenu from '@/modules/chat/composer/CommandMenu';
import { PromptInputButton } from '@/modules/chat/composer/PromptInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { SlashCommand } from '@/shared/types';

type ComposerToolsMenuProps = {
  slashCommandsCount: number;
  commands: SlashCommand[];
  frequentCommands: SlashCommand[];
  onAttachFiles: () => void;
  onCommandSelect: (command: SlashCommand, index: number, isHover: boolean) => void;
};

const filterCommands = (commands: SlashCommand[], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return commands;
  }

  return commands.filter((command) =>
    `${command.name} ${command.description ?? ''} ${command.namespace ?? ''}`.toLowerCase().includes(normalized),
  );
};

/**
 * Rendered by chat's ChatComposer. The plus button opens attach-files and the
 * command list; choosing the command list replaces this menu with a searchable,
 * categorized command popup.
 */
export function ComposerToolsMenu({
  slashCommandsCount,
  commands,
  frequentCommands,
  onAttachFiles,
  onCommandSelect,
}: ComposerToolsMenuProps) {
  const { t } = useTranslation('chat');
  const menuLabel = t('input.toolsMenu', { defaultValue: 'Attach files or show commands' });
  const attachLabel = t('input.attachFiles');
  const commandsLabel = t('input.showAllCommands');
  // Kept open across the action list and the command list, so Show all commands
  // can replace the first popup instead of dismissing it.
  const [isOpen, setIsOpen] = useState(false);
  // Which sheet is visible. Closing the menu returns to the action list.
  const [panel, setPanel] = useState<'actions' | 'commands'>('actions');
  // Text in the command sheet's search box. Cleared with the sheet so the next
  // open starts from the full categorized list.
  const [commandQuery, setCommandQuery] = useState('');
  const visibleCommands = useMemo(
    () => filterCommands(commands, commandQuery),
    [commands, commandQuery],
  );

  const closeMenu = () => {
    setIsOpen(false);
    setPanel('actions');
    setCommandQuery('');
  };

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(next) => {
        if (next) {
          setIsOpen(true);
          return;
        }
        closeMenu();
      }}
    >
      <DropdownMenuTrigger asChild>
        <PromptInputButton
          aria-label={menuLabel}
          title={menuLabel}
          className="rounded-lg border border-border/70 bg-background/70 shadow-sm hover:border-primary/25 hover:bg-background/70"
        >
          <PlusIcon />
        </PromptInputButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className={cn(
          'z-[100] overflow-hidden rounded-xl border-border shadow-xl',
          panel === 'commands' ? 'p-0' : 'min-w-52 p-1',
        )}
      >
        {panel === 'actions' ? (
          <>
            <DropdownMenuItem className="rounded-lg px-2.5 py-1.5" onSelect={onAttachFiles}>
              <PaperclipIcon />
              {attachLabel}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg px-2.5 py-1.5"
              onSelect={(event) => {
                event.preventDefault();
                setPanel('commands');
              }}
            >
              <MessageSquareIcon />
              <span className="min-w-0 flex-1 truncate">{commandsLabel}</span>
              {slashCommandsCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {slashCommandsCount}
                </span>
              )}
            </DropdownMenuItem>
          </>
        ) : (
          <CommandMenu
            contained
            isOpen
            commands={visibleCommands}
            frequentCommands={commandQuery.trim() ? [] : frequentCommands}
            onSelect={(command, index, isHover) => {
              if (isHover) {
                return;
              }
              onCommandSelect(command, index, false);
              closeMenu();
            }}
            onClose={closeMenu}
            query={commandQuery}
            onQueryChange={setCommandQuery}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
