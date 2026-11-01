import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, Plus, X } from 'lucide-react';

import { Button, Dialog, DialogContent, DialogTitle, Input, ScrollArea } from '@/shared/ui';
import FolderTree from '@/modules/project-creation-wizard/FolderTree';
import { browseFilesystemFolders, createFolderInFilesystem } from '@/modules/project-creation-wizard/utils/workspaceApi';
import { joinFolderPath, listAncestorPaths } from '@/modules/project-creation-wizard/utils/pathUtils';
import type { FolderDirectoryListing } from '@/shared/types';

type FolderBrowserModalProps = {
  isOpen: boolean;
  autoAdvanceOnSelect: boolean;
  onClose: () => void;
  onFolderSelected: (folderPath: string, advanceToConfirm: boolean) => void;
};

/** Opened by WorkspacePathField so the user can browse the filesystem and pick or create the workspace folder. */
export default function FolderBrowserModal({
  isOpen,
  autoAdvanceOnSelect,
  onClose,
  onFolderSelected,
}: FolderBrowserModalProps) {
  const { t } = useTranslation();
  // Directory listings keyed by absolute path. Expanding a folder reads this cache instead of browsing again.
  const [listings, setListings] = useState<Record<string, FolderDirectoryListing>>({});
  // Paths whose children are currently shown. The chain from `/` to the home folder starts open.
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  // The folder highlighted in the tree. The footer confirms this path.
  const [selectedPath, setSelectedPath] = useState('');
  // Filesystem root the tree is drawn from. Home is used when ancestor directories cannot be listed.
  const [rootPath, setRootPath] = useState<string | null>(null);
  // Dot-directories stay in the cache and are only hidden from the tree.
  const [showHiddenFolders, setShowHiddenFolders] = useState(false);
  // Inline name field for creating a directory inside the selected folder.
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tRef = useRef(t);
  tRef.current = t;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const listingsRef = useRef(listings);
  listingsRef.current = listings;

  const loadDirectory = useCallback(async (folderPath: string) => {
    const current = listingsRef.current[folderPath];
    if (current?.status === 'ready' || current?.status === 'loading') {
      return;
    }

    const loadingListing: FolderDirectoryListing = { status: 'loading', children: [] };
    listingsRef.current = { ...listingsRef.current, [folderPath]: loadingListing };
    setListings(listingsRef.current);

    try {
      const result = await browseFilesystemFolders(folderPath);
      if (!isOpenRef.current) {
        return;
      }
      setListings((previous) => ({
        ...previous,
        [folderPath]: { status: 'ready', children: result.suggestions },
      }));
    } catch (loadError) {
      if (!isOpenRef.current) {
        return;
      }
      setListings((previous) => ({
        ...previous,
        [folderPath]: {
          status: 'error',
          children: [],
          errorMessage: loadError instanceof Error ? loadError.message : tRef.current('folderBrowser.loadFailed'),
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setListings({});
      setExpandedPaths([]);
      setSelectedPath('');
      setRootPath(null);
      setError(null);
      setShowNewFolderInput(false);
      setNewFolderName('');
      return;
    }

    let cancelled = false;

    const openAtHome = async () => {
      setError(null);

      try {
        const home = await browseFilesystemFolders('~');
        if (cancelled) {
          return;
        }

        const ancestors = listAncestorPaths(home.path);
        const loadedListings: Record<string, FolderDirectoryListing> = {
          [home.path]: { status: 'ready', children: home.suggestions },
        };

        const ancestorResults = await Promise.allSettled(
          ancestors
            .filter((ancestorPath) => ancestorPath !== home.path)
            .map(async (ancestorPath) => {
              const result = await browseFilesystemFolders(ancestorPath);
              return [ancestorPath, result.suggestions] as const;
            }),
        );

        if (cancelled) {
          return;
        }

        for (const result of ancestorResults) {
          if (result.status !== 'fulfilled') {
            continue;
          }
          const [ancestorPath, suggestions] = result.value;
          loadedListings[ancestorPath] = { status: 'ready', children: suggestions };
        }

        // Keep the longest prefix the server allowed, so a forbidden filesystem root does not hide a parent that did load.
        const openedPaths = ancestors.filter((ancestorPath) => loadedListings[ancestorPath]);
        setListings(loadedListings);
        setExpandedPaths(openedPaths);
        setSelectedPath(home.path);
        setRootPath(openedPaths[0] ?? home.path);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : tRef.current('folderBrowser.loadFailed'));
      }
    };

    void openAtHome();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const resetNewFolderState = () => {
    setShowNewFolderInput(false);
    setNewFolderName('');
  };

  const handleClose = () => {
    resetNewFolderState();
    onClose();
  };

  const expandDirectory = useCallback((folderPath: string) => {
    setExpandedPaths((previous) => (previous.includes(folderPath) ? previous : [...previous, folderPath]));
    void loadDirectory(folderPath);
  }, [loadDirectory]);

  const collapseDirectory = useCallback((folderPath: string) => {
    setExpandedPaths((previous) => previous.filter((path) => path !== folderPath));
  }, []);

  const selectDirectory = useCallback((folderPath: string) => {
    setSelectedPath(folderPath);
    expandDirectory(folderPath);
  }, [expandDirectory]);

  const confirmDirectory = useCallback((folderPath: string) => {
    onFolderSelected(folderPath, autoAdvanceOnSelect);
  }, [autoAdvanceOnSelect, onFolderSelected]);

  const handleCreateFolder = useCallback(async () => {
    const parentPath = selectedPath.trim();
    const folderName = newFolderName.trim();
    if (!parentPath || !folderName) {
      return;
    }

    setCreatingFolder(true);
    setError(null);

    try {
      const createdPath = await createFolderInFilesystem(joinFolderPath(parentPath, folderName));
      const refreshed = await browseFilesystemFolders(parentPath);
      if (!isOpenRef.current) {
        return;
      }
      setListings((previous) => ({
        ...previous,
        [parentPath]: { status: 'ready', children: refreshed.suggestions },
      }));
      setExpandedPaths((previous) => (previous.includes(parentPath) ? previous : [...previous, parentPath]));
      setSelectedPath(createdPath);
      resetNewFolderState();
    } catch (createError) {
      if (!isOpenRef.current) {
        return;
      }
      setError(createError instanceof Error ? createError.message : t('folderBrowser.createFailed'));
    } finally {
      if (isOpenRef.current) {
        setCreatingFolder(false);
      }
    }
  }, [newFolderName, selectedPath, t]);

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent
        wrapperClassName="z-[70]"
        className="z-[70] flex h-[min(80vh,40rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="not-sr-only text-lg font-semibold text-foreground">
              {t('folderBrowser.title')}
            </DialogTitle>
            {selectedPath && (
              <p className="mt-1 truncate text-sm text-muted-foreground">{selectedPath}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={showHiddenFolders}
              title={showHiddenFolders ? t('folderBrowser.hideHidden') : t('folderBrowser.showHidden')}
              aria-label={showHiddenFolders ? t('folderBrowser.hideHidden') : t('folderBrowser.showHidden')}
              className={showHiddenFolders ? 'bg-accent text-accent-foreground' : undefined}
              onClick={() => setShowHiddenFolders((previous) => !previous)}
            >
              {showHiddenFolders ? <Eye /> : <EyeOff />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('buttons.close')}
              onClick={handleClose}
            >
              <X />
            </Button>
          </div>
        </div>

        {error && (
          <p className="px-6 pt-3 text-sm text-destructive">{error}</p>
        )}

        <ScrollArea overlayScrollbar className="min-h-0 flex-1">
          <div className="-mr-3 px-3 py-2">
            {rootPath ? (
              <FolderTree
                rootPath={rootPath}
                listings={listings}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                showHiddenFolders={showHiddenFolders}
                onExpand={expandDirectory}
                onCollapse={collapseDirectory}
                onSelect={selectDirectory}
                onConfirm={confirmDirectory}
              />
            ) : (
              !error && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border px-6 py-6">
          {showNewFolderInput && (
            <div className="mb-4 flex items-center gap-2">
              <Input
                type="text"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder={t('folderBrowser.newFolderPlaceholder')}
                className="flex-1"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleCreateFolder();
                  }
                  if (event.key === 'Escape') {
                    resetNewFolderState();
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void handleCreateFolder()}
                disabled={!newFolderName.trim() || !selectedPath || creatingFolder}
              >
                {creatingFolder ? <Loader2 className="animate-spin" /> : t('folderBrowser.create')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetNewFolderState}>
                {t('common:cancel')}
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            aria-pressed={showNewFolderInput}
            onClick={() => setShowNewFolderInput((previous) => !previous)}
            disabled={!selectedPath}
          >
            <Plus />
            {t('folderBrowser.createFolder')}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common:cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => confirmDirectory(selectedPath)}
              disabled={!selectedPath}
            >
              {t('folderBrowser.useThisFolder')}
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
