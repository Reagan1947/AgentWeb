import browserIconSvg from '@/shared/ui/browser-icon.svg?raw';

type BrowserIconProps = {
  className?: string;
};

// Renders the browser globe artwork. currentColor lets the caller tint it; the path is left unchanged.
/** Used by the workspace tab bar and the browser empty state to show the browser globe. */
export function BrowserIcon({ className }: BrowserIconProps) {
  const svgStart = browserIconSvg.indexOf('<svg');
  const svg = browserIconSvg
    .slice(svgStart)
    .replace('<svg ', '<svg fill="currentColor" aria-hidden="true" ')
    .replace(' width="200" height="200"', '');

  return (
    <span
      className={`inline-flex ${className ?? ''} [&>svg]:h-full [&>svg]:w-full`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
