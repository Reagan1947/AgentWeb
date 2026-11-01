import { useTranslation } from 'react-i18next';

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  InputGroup,
  InputGroupInput,
} from '@/shared/ui';
import { shouldShowGithubAuthentication } from '@/modules/project-creation-wizard/utils/pathUtils';
import type { GithubTokenCredential, TokenMode } from '@/shared/types';
import GithubAuthenticationCard from '@/modules/project-creation-wizard/GithubAuthenticationCard';
import WorkspacePathField from '@/modules/project-creation-wizard/WorkspacePathField';

type StepConfigurationProps = {
  workspacePath: string;
  githubUrl: string;
  tokenMode: TokenMode;
  selectedGithubToken: string;
  newGithubToken: string;
  availableTokens: GithubTokenCredential[];
  loadingTokens: boolean;
  tokenLoadError: string | null;
  isCreating: boolean;
  onWorkspacePathChange: (workspacePath: string) => void;
  onGithubUrlChange: (githubUrl: string) => void;
  onTokenModeChange: (tokenMode: TokenMode) => void;
  onSelectedGithubTokenChange: (tokenId: string) => void;
  onNewGithubTokenChange: (tokenValue: string) => void;
  onAdvanceToConfirm: () => void;
};

/** Rendered by ProjectCreationWizard as step 1, collecting the workspace path, clone URL and GitHub authentication. */
export default function StepConfiguration({
  workspacePath,
  githubUrl,
  tokenMode,
  selectedGithubToken,
  newGithubToken,
  availableTokens,
  loadingTokens,
  tokenLoadError,
  isCreating,
  onWorkspacePathChange,
  onGithubUrlChange,
  onTokenModeChange,
  onSelectedGithubTokenChange,
  onNewGithubTokenChange,
  onAdvanceToConfirm,
}: StepConfigurationProps) {
  const { t } = useTranslation();
  const showGithubAuth = shouldShowGithubAuthentication(githubUrl);

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="project-workspace-path">
          {t('projectWizard.step2.newPath')}
        </FieldLabel>

        <WorkspacePathField
          id="project-workspace-path"
          value={workspacePath}
          disabled={isCreating}
          onChange={onWorkspacePathChange}
          onAdvanceToConfirm={onAdvanceToConfirm}
        />

        <FieldDescription>{t('projectWizard.step2.newHelp')}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="project-github-url">
          {t('projectWizard.step2.githubUrl')}
        </FieldLabel>
        <InputGroup data-disabled={isCreating || undefined}>
          <InputGroupInput
            id="project-github-url"
            type="text"
            value={githubUrl}
            onChange={(event) => onGithubUrlChange(event.target.value)}
            placeholder="https://github.com/username/repository"
            disabled={isCreating}
          />
        </InputGroup>
        <FieldDescription>{t('projectWizard.step2.githubHelp')}</FieldDescription>
      </Field>

      {showGithubAuth && (
        <GithubAuthenticationCard
          tokenMode={tokenMode}
          selectedGithubToken={selectedGithubToken}
          newGithubToken={newGithubToken}
          availableTokens={availableTokens}
          loadingTokens={loadingTokens}
          tokenLoadError={tokenLoadError}
          onTokenModeChange={onTokenModeChange}
          onSelectedGithubTokenChange={onSelectedGithubTokenChange}
          onNewGithubTokenChange={onNewGithubTokenChange}
        />
      )}
    </FieldGroup>
  );
}
