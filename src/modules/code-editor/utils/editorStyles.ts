import { APPLE_COLOR } from '@/shared/constants';

export const getEditorLoadingStyles = (isDarkMode: boolean) => {
  return `
    .code-editor-loading {
      background-color: ${isDarkMode ? APPLE_COLOR.surfaceDark : APPLE_COLOR.surfaceCard} !important;
    }

    .code-editor-loading:hover {
      background-color: ${isDarkMode ? APPLE_COLOR.surfaceDark : APPLE_COLOR.surfaceCard} !important;
    }
  `;
};

export const getEditorStyles = (isDarkMode: boolean) => {
  return `
    .cm-deletedChunk {
      background-color: ${isDarkMode ? 'rgba(229, 57, 53, 0.15)' : 'rgba(229, 57, 53, 0.12)'} !important;
      border-left: 3px solid ${isDarkMode ? 'rgba(229, 57, 53, 0.6)' : APPLE_COLOR.error} !important;
      padding-left: 4px !important;
    }

    .cm-insertedChunk {
      background-color: ${isDarkMode ? 'rgba(39, 166, 68, 0.15)' : 'rgba(39, 166, 68, 0.12)'} !important;
      border-left: 3px solid ${isDarkMode ? 'rgba(39, 166, 68, 0.6)' : APPLE_COLOR.success} !important;
      padding-left: 4px !important;
    }

    .cm-editor.cm-merge-b .cm-changedText {
      background: ${isDarkMode ? 'rgba(39, 166, 68, 0.4)' : 'rgba(39, 166, 68, 0.3)'} !important;
      padding-top: 2px !important;
      padding-bottom: 2px !important;
      margin-top: -2px !important;
      margin-bottom: -2px !important;
    }

    .cm-editor .cm-deletedChunk .cm-changedText {
      background: ${isDarkMode ? 'rgba(229, 57, 53, 0.4)' : 'rgba(229, 57, 53, 0.3)'} !important;
      padding-top: 2px !important;
      padding-bottom: 2px !important;
      margin-top: -2px !important;
      margin-bottom: -2px !important;
    }

    .cm-gutter.cm-gutter-minimap {
      background-color: ${isDarkMode ? APPLE_COLOR.surfaceDarkSoft : APPLE_COLOR.surfaceSoft};
    }

    .cm-editor-toolbar-panel {
      padding: 4px 10px;
      background-color: ${isDarkMode ? APPLE_COLOR.surfaceDarkElevated : APPLE_COLOR.surfaceCard};
      border-bottom: 1px solid ${isDarkMode ? APPLE_COLOR.hairlineDark : APPLE_COLOR.hairline};
      color: ${isDarkMode ? APPLE_COLOR.onDarkSoft : APPLE_COLOR.body};
      font-size: 12px;
    }

    .cm-diff-nav-btn,
    .cm-toolbar-btn {
      padding: 3px;
      background: transparent;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
      transition: background-color 0.2s;
    }

    .cm-diff-nav-btn:hover,
    .cm-toolbar-btn:hover {
      background-color: ${isDarkMode ? APPLE_COLOR.hairlineDark : APPLE_COLOR.canvas};
    }

    .cm-diff-nav-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
};
