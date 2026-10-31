import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { copyTextToClipboard } from '@/shared/utils';
import { Trace, TraceDescription, TraceIcon, TraceLine, TraceTitle } from '@/shared/ui';
import { ToolStatusBadge } from '@/modules/chat/tools/ToolStatusBadge';
import type { ToolStatus } from '@/shared/types';

type ActionType = 'copy' | 'open-file' | 'jump-to-results' | 'none';

type OneLineDisplayProps = {
  toolName: string;
  icon?: string;
  label?: string;
  value: string;
  secondary?: string;
  action?: ActionType;
  onAction?: () => void;
  style?: string;
  wrapText?: boolean;
  colorScheme?: {
    primary?: string;
    secondary?: string;
    background?: string;
    border?: string;
    icon?: string;
  };
  resultId?: string;
  toolResult?: any;
  toolId?: string;
  status?: ToolStatus;
};

/**
 * Unified one-line display for simple tool inputs and results
 * Used by: Bash, Read, Grep/Glob (minimized), TodoRead, etc.
 *
 * Rendered by chat's ToolRenderer for tools configured as single-line.
 */
export const OneLineDisplay: React.FC<OneLineDisplayProps> = ({
  toolName,
  icon,
  label,
  value,
  secondary,
  action = 'none',
  onAction,
  style,
  wrapText = false,
  colorScheme = {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    background: '',
    border: 'border-border',
    icon: 'text-muted-foreground',
  },
  toolResult,
  toolId,
  status,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isTerminal = style === 'terminal';

  const handleAction = async () => {
    if (action === 'copy' && value) {
      const didCopy = await copyTextToClipboard(value);
      if (!didCopy) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (onAction) {
      onAction();
    }
  };

  const traceStatus = status === 'running' ? 'running' : status === 'error' || status === 'denied' ? 'error' : undefined;

  const renderCopyButton = () => (
    <button
      onClick={handleAction}
      className="ml-1 flex-shrink-0 text-muted-foreground/40 opacity-0 transition-all hover:text-muted-foreground group-hover:opacity-100"
      title={t('chat:misc.copyToClipboard')}
      aria-label={t('chat:misc.copyToClipboard')}
    >
      {copied ? (
        <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );

  const name = label || toolName;

  if (isTerminal) {
    return (
      <Trace className="group my-1">
        <TraceLine status={traceStatus} className="w-full">
          <TraceIcon className="text-emerald-500">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </TraceIcon>
          <TraceTitle className={wrapText ? 'whitespace-pre-wrap break-all font-mono text-emerald-500' : 'font-mono text-emerald-500'}>
            <span className="select-none text-emerald-600 dark:text-emerald-500">$ </span>
            {value}
          </TraceTitle>
          {status && <ToolStatusBadge status={status} />}
          {action === 'copy' && renderCopyButton()}
        </TraceLine>
        {secondary && <TraceDescription className="pl-5 text-[11px] italic">{secondary}</TraceDescription>}
      </Trace>
    );
  }

  if (action === 'open-file') {
    const displayName = value.split('/').pop() || value;
    return (
      <Trace>
        <TraceLine status={traceStatus} className="w-full">
          <TraceTitle className="text-muted-foreground">{name}</TraceTitle>
          <span className="text-[10px] text-muted-foreground/40">/</span>
          <button
            type="button"
            onClick={handleAction}
            className="min-w-0 flex-1 truncate text-left font-mono text-xs text-primary transition-colors hover:text-primary/80 hover:underline"
            title={value}
          >
            {displayName}
          </button>
          {status && <ToolStatusBadge status={status} className="ml-auto" />}
        </TraceLine>
      </Trace>
    );
  }

  if (action === 'jump-to-results') {
    return (
      <Trace>
        <TraceLine status={traceStatus} className="w-full">
          <TraceTitle className="text-muted-foreground">{name}</TraceTitle>
          <span className="text-[10px] text-muted-foreground/40">/</span>
          <span className={`min-w-0 flex-1 truncate font-mono text-xs ${colorScheme.primary}`}>{value}</span>
          {secondary && <TraceDescription className="italic">{secondary}</TraceDescription>}
          {status && <ToolStatusBadge status={status} />}
          {toolResult && (
            <a
              href={`#tool-result-${toolId}`}
              className="flex flex-shrink-0 items-center text-primary transition-colors hover:text-primary/80"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          )}
        </TraceLine>
      </Trace>
    );
  }

  return (
    <Trace>
      <TraceLine status={traceStatus} className={`w-full ${colorScheme.background || ''}`}>
        {icon && icon !== 'terminal' && <TraceIcon className={colorScheme.icon}>{icon}</TraceIcon>}
        {!icon && name && <TraceTitle className="text-muted-foreground">{name}</TraceTitle>}
        {(icon || name) && <span className="text-[10px] text-muted-foreground/40">/</span>}
        <span className={`min-w-0 flex-1 font-mono text-xs ${wrapText ? 'whitespace-pre-wrap break-all' : 'truncate'} ${colorScheme.primary}`}>
          {value}
        </span>
        {secondary && <TraceDescription className={`italic ${colorScheme.secondary}`}>{secondary}</TraceDescription>}
        {status && <ToolStatusBadge status={status} />}
        {action === 'copy' && renderCopyButton()}
      </TraceLine>
    </Trace>
  );
};
