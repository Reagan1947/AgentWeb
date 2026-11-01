import { useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Loader2 } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger, FolderBoldIcon, FolderNotchOpenBoldIcon } from '@/shared/ui';
import { cn } from '@/shared/utils';
import type { FolderDirectoryListing } from '@/shared/types';

type FolderTreeProps = {
  rootPath: string;
  listings: Record<string, FolderDirectoryListing>;
  expandedPaths: string[];
  selectedPath: string;
  showHiddenFolders: boolean;
  onExpand: (folderPath: string) => void;
  onCollapse: (folderPath: string) => void;
  onSelect: (folderPath: string) => void;
  onConfirm: (folderPath: string) => void;
};

type FolderTreeNodeProps = {
  folderPath: string;
  depth: number;
  listings: Record<string, FolderDirectoryListing>;
  expandedPaths: string[];
  selectedPath: string;
  showHiddenFolders: boolean;
  selectedRowRef: RefObject<HTMLButtonElement | null>;
  onExpand: (folderPath: string) => void;
  onCollapse: (folderPath: string) => void;
  onSelect: (folderPath: string) => void;
  onConfirm: (folderPath: string) => void;
};

function folderDisplayName(folderPath: string): string {
  if (folderPath === '/' || /^[A-Za-z]:\\?$/.test(folderPath)) {
    return folderPath;
  }

  const segments = folderPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? folderPath;
}

function visibleChildPaths(listing: FolderDirectoryListing | undefined, showHiddenFolders: boolean): string[] {
  if (!listing || listing.status !== 'ready') {
    return [];
  }

  return listing.children
    .filter((folder) => showHiddenFolders || !folder.name.startsWith('.'))
    .sort((firstFolder, secondFolder) =>
      firstFolder.name.toLowerCase().localeCompare(secondFolder.name.toLowerCase()),
    )
    .map((folder) => folder.path);
}

function FolderTreeNode({
  folderPath,
  depth,
  listings,
  expandedPaths,
  selectedPath,
  showHiddenFolders,
  selectedRowRef,
  onExpand,
  onCollapse,
  onSelect,
  onConfirm,
}: FolderTreeNodeProps) {
  const { t } = useTranslation();
  const listing = listings[folderPath];
  const expanded = expandedPaths.includes(folderPath);
  const selected = folderPath === selectedPath;
  const childPaths = visibleChildPaths(listing, showHiddenFolders);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onExpand(folderPath);
          return;
        }
        onCollapse(folderPath);
      }}
    >
      <div className="py-1" style={{ paddingLeft: depth * 12 }}>
        <div
          className={cn(
            'group flex items-center gap-1 rounded-md px-1 py-1.5',
            selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
          )}
        >
          <CollapsibleTrigger
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md [&[data-state=open]>svg]:rotate-90',
              selected ? 'text-accent-foreground' : 'text-muted-foreground group-hover:text-accent-foreground',
            )}
            aria-label={expanded ? t('folderBrowser.collapseFolder') : t('folderBrowser.expandFolder')}
          >
            {listing?.status === 'loading' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronRight className="size-4 transition-transform" />
            )}
          </CollapsibleTrigger>
          <button
            ref={selected ? selectedRowRef : undefined}
            type="button"
            aria-selected={selected}
            onClick={() => onSelect(folderPath)}
            onDoubleClick={() => onConfirm(folderPath)}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 rounded-md py-0 pl-0.5 pr-1 text-left text-base',
              selected ? 'font-medium' : 'text-foreground',
            )}
          >
            {expanded ? (
              <FolderNotchOpenBoldIcon className="size-5 shrink-0 text-muted-foreground" />
            ) : (
              <FolderBoldIcon className="size-5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{folderDisplayName(folderPath)}</span>
          </button>
        </div>
      </div>

      <CollapsibleContent>
        {expanded && listing?.status === 'error' && (
          <p className="py-1 text-xs text-destructive" style={{ paddingLeft: (depth + 1) * 12 + 28 }}>
            {listing.errorMessage}
          </p>
        )}
        {expanded && listing?.status === 'ready' && childPaths.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 12 + 28 }}>
            {t('folderBrowser.noSubfolders')}
          </p>
        )}
        {expanded && childPaths.length > 0 && (
          <div role="group">
            {childPaths.map((childPath) => (
              <FolderTreeNode
                key={childPath}
                folderPath={childPath}
                depth={depth + 1}
                listings={listings}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                showHiddenFolders={showHiddenFolders}
                selectedRowRef={selectedRowRef}
                onExpand={onExpand}
                onCollapse={onCollapse}
                onSelect={onSelect}
                onConfirm={onConfirm}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Rendered by FolderBrowserModal so a workspace folder can be picked from an expandable directory tree. */
export default function FolderTree({
  rootPath,
  listings,
  expandedPaths,
  selectedPath,
  showHiddenFolders,
  onExpand,
  onCollapse,
  onSelect,
  onConfirm,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const selectedRowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedPath]);

  return (
    <div role="tree" aria-label={t('folderBrowser.title')}>
      <FolderTreeNode
        folderPath={rootPath}
        depth={0}
        listings={listings}
        expandedPaths={expandedPaths}
        selectedPath={selectedPath}
        showHiddenFolders={showHiddenFolders}
        selectedRowRef={selectedRowRef}
        onExpand={onExpand}
        onCollapse={onCollapse}
        onSelect={onSelect}
        onConfirm={onConfirm}
      />
    </div>
  );
}
