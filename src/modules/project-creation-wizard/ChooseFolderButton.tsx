import { FolderBoldIcon, InputGroupButton } from '@/shared/ui';

type ChooseFolderButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

/**
 * Used by the project-creation wizard and the settings module, inside an InputGroup,
 * so every field that opens the folder browser offers the same button.
 */
export default function ChooseFolderButton({ onClick, disabled }: ChooseFolderButtonProps) {
  return (
    <InputGroupButton onClick={onClick} disabled={disabled}>
      <FolderBoldIcon className="size-4" />
      Choose a Folder
    </InputGroupButton>
  );
}
