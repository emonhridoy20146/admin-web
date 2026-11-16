'use client';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/shared/ui/badge';
import type { Tone } from '@/shared/ui/status';

export const OUTCOME_TONE: Record<string, Tone> = {
  paid: 'paid', partial_paid: 'dueToday', promised: 'promised', not_home: 'neutral', refused: 'danger',
  shifted_address: 'warning', customer_dead: 'neutral', product_returned_request: 'warning', other: 'neutral',
};

/** A visit outcome with its colour, icon and label; exported for other features (co-work session visits). */
export function VisitOutcomeBadge({ outcome }: { outcome: string }) {
  const { t } = useTranslation('visits');
  return <Badge tone={OUTCOME_TONE[outcome] ?? 'neutral'}>{t(`outcome.${outcome}`, { defaultValue: outcome })}</Badge>;
}
