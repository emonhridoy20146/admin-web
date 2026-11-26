import {
  AlarmClock, BadgeCheck, CalendarClock, CheckCircle2, CircleDot, CloudUpload, Flag, Handshake, Info,
  PackageX, ShieldAlert, TriangleAlert, OctagonX, Undo2, type LucideIcon,
} from 'lucide-react';

export type Tone =
  | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
  | 'overdue' | 'dueToday' | 'promised' | 'current' | 'paid' | 'badSuggested' | 'tagged' | 'pending' | 'mock' | 'returned';

export const toneClass: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  neutral: 'bg-surface-hover text-fg-secondary',
  brand: 'bg-primary-subtle text-primary-subtle-fg',
  overdue: 'bg-st-overdue-bg text-st-overdue',
  dueToday: 'bg-st-due-today-bg text-st-due-today',
  promised: 'bg-st-promised-bg text-st-promised',
  current: 'bg-st-current-bg text-st-current',
  paid: 'bg-st-paid-bg text-st-paid',
  badSuggested: 'bg-st-bad-suggested-bg text-st-bad-suggested border border-dashed border-st-bad-suggested',
  tagged: 'bg-st-tagged-bg text-st-tagged',
  pending: 'bg-st-pending-bg text-st-pending',
  mock: 'bg-st-mock-bg text-st-mock',
  returned: 'bg-st-returned-bg text-st-returned',
};

export const toneFg: Record<Tone, string> = {
  success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-info', neutral: 'text-fg-tertiary',
  brand: 'text-primary', overdue: 'text-st-overdue', dueToday: 'text-st-due-today', promised: 'text-st-promised',
  current: 'text-st-current', paid: 'text-st-paid', badSuggested: 'text-st-bad-suggested', tagged: 'text-st-tagged-bg',
  pending: 'text-st-pending', mock: 'text-st-mock', returned: 'text-st-returned',
};

export const toneIcon: Record<Tone, LucideIcon> = {
  success: CheckCircle2, warning: TriangleAlert, danger: OctagonX, info: Info, neutral: CircleDot, brand: CircleDot,
  overdue: AlarmClock, dueToday: CalendarClock, promised: Handshake, current: CircleDot, paid: BadgeCheck,
  badSuggested: Flag, tagged: Flag, pending: CloudUpload, mock: ShieldAlert, returned: Undo2,
};

/** Domain status → tone + common i18n label key (+ its own icon when the tone's icon would not say it). One table so every screen "says" the same thing. */
export const STATUS: Record<string, { tone: Tone; label: string; icon?: LucideIcon }> = {
  // customer
  overdue: { tone: 'overdue', label: 'status.overdue' },
  due_today: { tone: 'dueToday', label: 'status.due_today' },
  promised_today: { tone: 'promised', label: 'status.promised_today' },
  paid_up: { tone: 'paid', label: 'status.paid_up' },
  current: { tone: 'current', label: 'status.current' },
  bad_suggested: { tone: 'badSuggested', label: 'status.bad_suggested' },
  tagged_bad: { tone: 'tagged', label: 'status.tagged_bad' },
  // contract 1.53.0 (FR-CUS-024, FR-W-073): invoices returned in the ERP are shown again but never counted
  returned: { tone: 'returned', label: 'status.returned', icon: Undo2 },
  returned_count: { tone: 'returned', label: 'status.returned_count', icon: Undo2 },
  only_returned: { tone: 'returned', label: 'status.only_returned', icon: PackageX },
  returned_payment: { tone: 'returned', label: 'status.returned_payment', icon: Undo2 },
  // collection
  received: { tone: 'pending', label: 'status.received' },
  posting: { tone: 'pending', label: 'status.posting' },
  posted: { tone: 'paid', label: 'status.posted' },
  conflict: { tone: 'danger', label: 'status.conflict' },
  posting_failed: { tone: 'warning', label: 'status.posting_failed' },
  resolved_posted: { tone: 'success', label: 'status.resolved_posted' },
  resolved_refund: { tone: 'neutral', label: 'status.resolved_refund' },
  resolved_voided: { tone: 'neutral', label: 'status.resolved_voided' },
  voided: { tone: 'neutral', label: 'status.voided' },
  // deposit (`submitted`: 1.35.0, final and sent to the ERP; the other four are deposits from before 1.35.0)
  submitted: { tone: 'success', label: 'status.submitted' },
  pending: { tone: 'pending', label: 'status.pending' },
  verified: { tone: 'success', label: 'status.verified' },
  rejected: { tone: 'danger', label: 'status.rejected' },
  deleted: { tone: 'neutral', label: 'status.deleted' },
  // handover
  pending_acceptance: { tone: 'pending', label: 'status.pending_acceptance' },
  accepted: { tone: 'success', label: 'status.accepted' },
  cancelled: { tone: 'neutral', label: 'status.cancelled' },
  expired: { tone: 'warning', label: 'status.expired' },
  reverted: { tone: 'neutral', label: 'status.reverted' },
  // cash
  ok: { tone: 'success', label: 'status.cash_ok' },
  warning: { tone: 'warning', label: 'status.cash_warning' },
  exceeded: { tone: 'danger', label: 'status.cash_exceeded' },
  // severity
  critical: { tone: 'danger', label: 'severity.critical' },
  high: { tone: 'overdue', label: 'severity.high' },
  medium: { tone: 'warning', label: 'severity.medium' },
  low: { tone: 'neutral', label: 'severity.low' },
  // plan schedule
  paid: { tone: 'paid', label: 'status.paid' },
  partial: { tone: 'dueToday', label: 'status.partial' },
  due: { tone: 'current', label: 'status.due' },
  upcoming: { tone: 'neutral', label: 'status.upcoming' },
  // flags
  mock_location: { tone: 'mock', label: 'flags.mock_location' },
  far_from_pin: { tone: 'warning', label: 'flags.far_from_pin' },
  clock_skew: { tone: 'warning', label: 'flags.clock_skew' },
  late_sync: { tone: 'pending', label: 'flags.late_sync' },
  duplicate_txn_ref: { tone: 'danger', label: 'flags.duplicate_txn_ref' },
  // contract 1.19.0: staff may work on any customer of their branch, so this is information, not a warning
  not_in_scope_at_record_time: { tone: 'info', label: 'flags.not_in_scope_at_record_time' },
  no_location: { tone: 'warning', label: 'flags.no_location' },
  // user
  active: { tone: 'success', label: 'status.active' },
  inactive: { tone: 'neutral', label: 'status.inactive' },
};

/** The fields of a customer row, map pin or search hit that say it has returned invoices (contract 1.53.0). */
export interface ReturnedLike {
  returnedInvoiceCount?: number | null;
  onlyReturned?: boolean | null;
}
/**
 * FR-W-073: which returned marker a customer shows. Every invoice returned (`onlyReturned`) → "Returned product customer";
 * some returned → "Returned ×N"; none → nothing. Older servers omit both fields (= none).
 */
export function returnedMark(x: ReturnedLike | null | undefined): { status: 'only_returned' | 'returned_count'; n: number } | null {
  const n = Math.max(0, x?.returnedInvoiceCount ?? 0);
  if (x?.onlyReturned) return { status: 'only_returned', n };
  return n > 0 ? { status: 'returned_count', n } : null;
}
