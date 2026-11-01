import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { ChevronDown, Eye, FileText, FolderPlus, List, Loader2, RefreshCw, Search, TableProperties, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '@/shared/ui';
import { cn } from '@/shared/utils';
import { MAX_FILE_UPLOAD_SIZE_LABEL, WORKSPACE_PANE_ICON_ACTION_CLASS, WORKSPACE_PANE_TOOLBAR_CHROME_CLASS } from '@/shared/constants';
import type { FileTreeViewMode } from '@/shared/types';

type FileTreeHeaderProps = {
  viewMode: FileTreeViewMode;
  onViewModeChange: (mode: FileTreeViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  // Toolbar actions
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onUploadFiles?: (files: FileList) => void;
  onRefresh?: () => void;
  onCollapseAll?: () => void;
  // Loading state
  loading?: boolean;
  operationLoading?: boolean;
  isUploading?: boolean;
  uploadProgress?: number | null;
};

/** Rendered by FileTree to host the search box, view-mode switch and the create/upload/refresh/collapse actions. */
export default function FileTreeHeader({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  onNewFile,
  onNewFolder,
  onUploadFiles,
  onRefresh,
  onCollapseAll,
  loading,
  operationLoading,
  isUploading,
  uploadProgress,
}: FileTreeHeaderProps) {
  const { t } = useTranslation();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleUploadInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files && files.length > 0) {
      onUploadFiles?.(files);
    }
    event.target.value = '';
  };

  return (
    <div className={cn('space-y-2', WORKSPACE_PANE_TOOLBAR_CHROME_CLASS)}>
      <div className="flex items-center">
        <div className="flex items-center gap-1">
          {/* Action buttons */}
          {onUploadFiles && (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUploadInputChange}
                tabIndex={-1}
                aria-hidden="true"
              />
              <Button
                variant="outline"
                size="sm"
                className={cn(WORKSPACE_PANE_ICON_ACTION_CLASS, 'relative')}
                onClick={() => uploadInputRef.current?.click()}
                title={
                  isUploading
                    ? t('fileTree.uploadingFiles', 'Uploading files')
                    : t('fileTree.uploadFiles', 'Upload files (max {{size}} each)', {
                        size: MAX_FILE_UPLOAD_SIZE_LABEL,
                      })
                }
                aria-label={t('fileTree.uploadFiles', 'Upload files (max {{size}} each)', {
                  size: MAX_FILE_UPLOAD_SIZE_LABEL,
                })}
                disabled={operationLoading}
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {isUploading && typeof uploadProgress === 'number' && (
                  <span className="absolute bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 overflow-hidden rounded-full bg-primary/20">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </span>
                )}
              </Button>
            </>
          )}
          {onNewFile && (
            <Button
              variant="outline"
              size="sm"
              className={WORKSPACE_PANE_ICON_ACTION_CLASS}
              onClick={onNewFile}
              title={t('fileTree.newFile', 'New File (Cmd+N)')}
              aria-label={t('fileTree.newFile', 'New File (Cmd+N)')}
              disabled={operationLoading}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          {onNewFolder && (
            <Button
              variant="outline"
              size="sm"
              className={WORKSPACE_PANE_ICON_ACTION_CLASS}
              onClick={onNewFolder}
              title={t('fileTree.newFolder', 'New Folder (Cmd+Shift+N)')}
              aria-label={t('fileTree.newFolder', 'New Folder (Cmd+Shift+N)')}
              disabled={operationLoading}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          )}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className={WORKSPACE_PANE_ICON_ACTION_CLASS}
              onClick={onRefresh}
              title={t('fileTree.refresh', 'Refresh')}
              aria-label={t('fileTree.refresh', 'Refresh')}
              disabled={operationLoading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </Button>
          )}
          {onCollapseAll && (
            <Button
              variant="outline"
              size="sm"
              className={WORKSPACE_PANE_ICON_ACTION_CLASS}
              onClick={onCollapseAll}
              title={t('fileTree.collapseAll', 'Collapse All')}
              aria-label={t('fileTree.collapseAll', 'Collapse All')}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Divider */}
          <div className="mx-0.5 h-4 w-px bg-border" />
          {/* View mode buttons */}
          <Button
            variant="outline"
            size="sm"
            className={cn(WORKSPACE_PANE_ICON_ACTION_CLASS, viewMode === 'simple' && 'border-primary bg-accent')}
            onClick={() => onViewModeChange('simple')}
            title={t('fileTree.simpleView')}
            aria-label={t('fileTree.simpleView')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(WORKSPACE_PANE_ICON_ACTION_CLASS, viewMode === 'compact' && 'border-primary bg-accent')}
            onClick={() => onViewModeChange('compact')}
            title={t('fileTree.compactView')}
            aria-label={t('fileTree.compactView')}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(WORKSPACE_PANE_ICON_ACTION_CLASS, viewMode === 'detailed' && 'border-primary bg-accent')}
            onClick={() => onViewModeChange('detailed')}
            title={t('fileTree.detailedView')}
            aria-label={t('fileTree.detailedView')}
          >
            <TableProperties className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('fileTree.searchPlaceholder')}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0.5 top-1/2 h-5 w-5 -translate-y-1/2 p-0 hover:bg-accent"
            onClick={() => onSearchQueryChange('')}
            title={t('fileTree.clearSearch')}
            aria-label={t('fileTree.clearSearch')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
