import { useEffect, useState } from 'react';
import { FileIcon, XIcon } from 'lucide-react';

import { ImageLightbox } from '@/modules/chat/transcript/ChatMessageImages';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/shared/ui';

type ComposerAttachmentProps = {
  file: File;
  onRemove: () => void;
  error?: string;
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Rendered by chat's ChatComposer for each pending attachment.
 * The chip is an Attachment; expanding an image and removing the file stay here.
 */
const ComposerAttachment = ({ file, onRemove, error }: ComposerAttachmentProps) => {
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <>
      <Attachment
        size="sm"
        orientation={isImage ? 'vertical' : 'horizontal'}
        state={error ? 'error' : 'done'}
        title={error}
      >
        <AttachmentMedia variant={isImage ? 'image' : 'icon'} className={isImage ? 'w-full' : undefined}>
          {isImage ? (
            preview
              ? <img src={preview} alt="" />
              : <div className="size-full animate-pulse bg-muted" />
          ) : (
            <FileIcon aria-hidden />
          )}
        </AttachmentMedia>
        {!isImage && (
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
            <AttachmentDescription>{error ?? formatFileSize(file.size)}</AttachmentDescription>
          </AttachmentContent>
        )}
        {isImage && preview && (
          <AttachmentTrigger aria-label={`Expand ${file.name}`} onClick={() => setExpanded(true)} />
        )}
        <AttachmentActions>
          <AttachmentAction aria-label={`Remove ${file.name}`} onClick={onRemove}>
            <XIcon />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      {expanded && preview && (
        <ImageLightbox src={preview} alt={file.name} onClose={() => setExpanded(false)} />
      )}
    </>
  );
};

export default ComposerAttachment;
