'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CircleCheck, ImageOff, Loader2, X } from 'lucide-react';
import { prepareImage, uploadMedia } from '@/shared/media/upload';
import { Button } from '@/shared/ui/button';
import { ErrorBanner } from '@/shared/ui/feedback';

type State = { phase: 'empty' } | { phase: 'working'; preview: string } | { phase: 'done'; preview: string; mediaId: string } | { phase: 'failed'; preview?: string; error: unknown };

/** FR-COL refund: a photo of the refund slip or of the money handed back, uploaded before the refund can be confirmed. */
export function ProofPicker({ onChange }: { onChange: (mediaId: string | null) => void }) {
  const { t } = useTranslation('collections');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [s, setS] = useState<State>({ phase: 'empty' });
  const preview = 'preview' in s ? s.preview : undefined;

  // the preview is an in-memory blob: release it when it is replaced or the picker goes away
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    onChange(null);
    const p = await prepareImage(file);
    if ('error' in p) return setS({ phase: 'failed', error: new Error(t(`proof.errors.${p.error}`)) });
    const url = URL.createObjectURL(p.blob);
    setS({ phase: 'working', preview: url });
    try {
      const mediaId = await uploadMedia('refund_proof', p.blob);
      setS({ phase: 'done', preview: url, mediaId });
      onChange(mediaId);
    } catch (e) {
      setS({ phase: 'failed', preview: url, error: e });
    }
  };
  const clear = () => {
    setS({ phase: 'empty' });
    onChange(null);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="space-y-2">
      <span id={`${id}-l`} className="block text-base font-medium text-fg">
        {t('proof.label')} <span className="text-danger" aria-hidden>*</span>
      </span>
      <p id={`${id}-h`} className="text-sm text-fg-secondary">{t('proof.help')}</p>
      <div className="flex flex-wrap items-center gap-3">
        {preview ? (
          <div className="relative size-20 overflow-hidden rounded-md border border-line bg-surface-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={preview} alt={t('proof.preview')} className="size-full object-cover" />
            {s.phase === 'working' && <span className="absolute inset-0 grid place-items-center bg-overlay"><Loader2 className="size-5 animate-spin text-primary-fg" aria-hidden /></span>}
          </div>
        ) : s.phase === 'failed' ? (
          <span className="grid size-20 place-items-center rounded-md border border-line bg-surface-subtle text-fg-tertiary"><ImageOff className="size-5" aria-hidden /></span>
        ) : null}
        <input ref={input} id={id} type="file" accept="image/*" capture="environment" className="sr-only" aria-labelledby={`${id}-l`} aria-describedby={`${id}-h`} onChange={(e) => void pick(e.target.files?.[0])} />
        <Button size="sm" onClick={() => input.current?.click()} disabled={s.phase === 'working'}>
          <Camera className="size-4" aria-hidden />
          {s.phase === 'empty' ? t('proof.pick') : t('proof.replace')}
        </Button>
        {s.phase !== 'empty' && s.phase !== 'working' && (
          <Button size="sm" variant="ghost" onClick={clear}>
            <X className="size-4" aria-hidden />
            {t('proof.remove')}
          </Button>
        )}
        <span className="text-sm" aria-live="polite">
          {s.phase === 'working' ? <span className="text-fg-secondary">{t('proof.uploading')}</span> : s.phase === 'done' ? <span className="inline-flex items-center gap-1 text-success"><CircleCheck className="size-4" aria-hidden />{t('proof.ready')}</span> : null}
        </span>
      </div>
      {s.phase === 'failed' ? <ErrorBanner error={s.error} /> : null}
    </div>
  );
}
