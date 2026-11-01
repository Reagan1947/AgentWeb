import { cn } from '@/shared/utils';

type AgentStatusLightProps = {
  loading: boolean;
  authenticated: boolean;
  label: string;
};

/** Rendered by the agents list and the agent settings layer as a provider's connection lamp. */
export default function AgentStatusLight({ loading, authenticated, label }: AgentStatusLightProps) {
  return (
    <span
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted/50"
      title={label}
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden>
        {loading && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
        )}
        <span
          className={cn(
            'relative inline-flex h-2.5 w-2.5 rounded-full',
            loading && 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]',
            !loading && authenticated && 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]',
            !loading && !authenticated && 'border border-muted-foreground/45 bg-transparent',
          )}
        />
      </span>
    </span>
  );
}
