import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FolderBoldIcon, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/shared/ui';
import { browseFilesystemFolders } from '@/modules/project-creation-wizard/utils/workspaceApi';
import { getSuggestionRootPath } from '@/modules/project-creation-wizard/utils/pathUtils';
import type { FolderSuggestion } from '@/shared/types';
import FolderBrowserModal from '@/modules/project-creation-wizard/FolderBrowserModal';

type WorkspacePathFieldProps = {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (path: string) => void;
  onAdvanceToConfirm: () => void;
};

/** Rendered by StepConfiguration to enter the workspace path with folder autocompletion and a browse button. */
export default function WorkspacePathField({
  id,
  value,
  disabled = false,
  onChange,
  onAdvanceToConfirm,
}: WorkspacePathFieldProps) {
  const { t } = useTranslation();
  const [pathSuggestions, setPathSuggestions] = useState<FolderSuggestion[]>([]);
  const [showPathDropdown, setShowPathDropdown] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

  useEffect(() => {
    if (value.trim().length <= 2) {
      setPathSuggestions([]);
      setShowPathDropdown(false);
      return;
    }

    // Debounce path lookup to avoid firing a request for every keystroke.
    const timerId = window.setTimeout(async () => {
      try {
        const directoryPath = getSuggestionRootPath(value);
        const result = await browseFilesystemFolders(directoryPath);
        const normalizedInput = value.toLowerCase();

        const matchingSuggestions = result.suggestions
          .filter((suggestion) => {
            const normalizedSuggestion = suggestion.path.toLowerCase();
            return (
              normalizedSuggestion.startsWith(normalizedInput) &&
              normalizedSuggestion !== normalizedInput
            );
          })
          .slice(0, 5);

        setPathSuggestions(matchingSuggestions);
        setShowPathDropdown(matchingSuggestions.length > 0);
      } catch (error) {
        console.error('Failed to load path suggestions:', error);
      }
    }, 200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [value]);

  const handleSuggestionSelect = useCallback(
    (suggestion: FolderSuggestion) => {
      onChange(suggestion.path);
      setShowPathDropdown(false);
    },
    [onChange],
  );

  const handleFolderSelected = useCallback(
    (selectedPath: string, advanceToConfirm: boolean) => {
      onChange(selectedPath);
      setShowFolderBrowser(false);
      if (advanceToConfirm) {
        onAdvanceToConfirm();
      }
    },
    [onAdvanceToConfirm, onChange],
  );

  return (
    <>
      <div className="relative">
        <InputGroup>
          <InputGroupInput
            id={id}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="/path/to/project/workspace"
            disabled={disabled}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Choice Folder"
              title={t('common:misc.browseFolders')}
              onClick={() => setShowFolderBrowser(true)}
              disabled={disabled}
            >
              <FolderBoldIcon className="size-4" />
              Choice Folder
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        {showPathDropdown && pathSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            {pathSuggestions.map((suggestion) => (
              <button
                key={suggestion.path}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <div className="font-medium">{suggestion.name}</div>
                <div className="text-xs text-muted-foreground">{suggestion.path}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <FolderBrowserModal
        isOpen={showFolderBrowser}
        autoAdvanceOnSelect={false}
        onClose={() => setShowFolderBrowser(false)}
        onFolderSelected={handleFolderSelected}
      />
    </>
  );
}
