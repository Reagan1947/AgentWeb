type FolderIconProps = {
  className?: string;
};

// Phosphor Bold folders. The path uses currentColor so the row can tint them.

/** Closed folder. Used by project creation and by the file tree for a collapsed directory. */
export function FolderBoldIcon({ className }: FolderIconProps) {
  return (
    <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M216 68h-82.61l-26-29.29a20 20 0 0 0-15-6.71H40a20 20 0 0 0-20 20v148.62A19.41 19.41 0 0 0 39.38 220h177.51A19.13 19.13 0 0 0 236 200.89V88a20 20 0 0 0-20-20M44 56h46.61l10.67 12H44Zm168 140H44V92h168Z"
      />
    </svg>
  );
}

/** Open folder. Used by project creation and by the file tree for an expanded directory. */
export function FolderNotchOpenBoldIcon({ className }: FolderIconProps) {
  return (
    <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M248.23 112.31A20 20 0 0 0 232 104h-12V88a20 20 0 0 0-20-20h-68l-26.66-20a20.12 20.12 0 0 0-12-4H40a20 20 0 0 0-20 20v144a12 12 0 0 0 12 12h179.1a12 12 0 0 0 11.33-8l28.49-81.47l.06-.17a20 20 0 0 0-2.75-18.05M92 68l28.8 21.6A12 12 0 0 0 128 92h68v12H69.77a20 20 0 0 0-18.94 13.58L44 137.15V68Zm110.59 128H48.89l23.72-68h153.76Z"
      />
    </svg>
  );
}
