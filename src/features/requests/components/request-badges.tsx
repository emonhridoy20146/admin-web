'use client';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, CheckCircle2, CircleDot, Hourglass, Lock, RotateCcw, Siren } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';
import type { Request } from '../api/requests';
import { whereNow } from '../model/requests';

const STATUS_LOOK: Record<string, { tone: Tone; icon: typeof CircleDot }> = {
  open: { tone: 'info', icon: CircleDot },
  in_progress: { tone: 'brand', icon: Hourglass },
  forwarded: { tone: 'pending', icon: ArrowRightLeft },
  reopened: { tone: 'warning', icon: RotateCcw },
  resolved: { tone: 'success', icon: CheckCircle2 },
  closed: { tone: 'neutral', icon: Lock },
};

/** Status = colour + icon + label; an unknown status shows its raw key. */
export function RequestStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('requests');
  const look = STATUS_LOOK[status] ?? { tone: 'neutral' as Tone, icon: CircleDot };
  return <Badge tone={look.tone} icon={look.icon}>{t(`status.${status}`, { defaultValue: status })}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation('requests');
  if (priority !== 'important') return <Badge tone="neutral" icon={false}>{t(`priority.${priority}`, { defaultValue: priority })}</Badge>;
  return <Badge tone="danger" icon={Siren}>{t('priority.important')}</Badge>;
}

export function WhereNow({ r }: { r: Pick<Request, 'currentQueue' | 'assignee'> }) {
  const { t } = useTranslation('requests');
  const w = whereNow(r);
  return <span className="text-fg-secondary">{w.kind === 'person' ? t('where.person', { name: w.name }) : t(`where.${w.queue}`)}</span>;
}
