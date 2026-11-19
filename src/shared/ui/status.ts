import {
  AlarmClock, BadgeCheck, CalendarClock, CheckCircle2, CircleDot, CloudUpload, Flag, Handshake, Info,
  ShieldAlert, TriangleAlert, OctagonX, type LucideIcon,
} from 'lucide-react';

export type Tone =
  | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
  | 'overdue' | 'dueToday' | 'promised' | 'current' | 'paid' | 'badSuggested' | 'tagged' | 'pending' | 'mock';

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
};

export const toneFg: Record<Tone, string> = {
  success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-info', neutral: 'text-fg-tertiary',
  brand: 'text-primary', overdue: 'text-st-overdue', dueToday: 'text-st-due-today', promised: 'text-st-promised',
  current: 'text-st-current', paid: 'text-st-paid', badSuggested: 'text-st-bad-suggested', tagged: 'text-st-tagged-bg',
  pending: 'text-st-pending', mock: 'text-st-mock',
};

export const toneIcon: Record<Tone, LucideIcon> = {
  success: CheckCircle2, warning: TriangleAlert, danger: OctagonX, info: Info, neutral: CircleDot, brand: CircleDot,
  overdue: AlarmClock, dueToday: CalendarClock, promised: Handshake, current: CircleDot, paid: BadgeCheck,
  badSuggested: Flag, tagged: Flag, pending: CloudUpload, mock: ShieldAlert,
};

/** Domain status → tone + common i18n label key. One table so every screen "says" the same thing. */
export const STATUS: Record<string, { tone: Tone; label: string }> = {
  // customer
  overdue: { tone: 'overdue', label: 'status.overdue' },
  due_today: { tone: 'dueToday', label: 'status.due_today' },
  promised_today: { tone: 'promised', label: 'status.promised_today' },
  paid_up: { tone: 'paid', label: 'status.paid_up' },
  current: { tone: 'current', label: 'status.current' },
  bad_suggested: { tone: 'badSuggested', label: 'status.bad_suggested' },
  tagged_bad: { tone: 'tagged', label: 'status.tagged_bad' },
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
  // deposit
  pending: { tone: 'pending', label: 'status.pending' },
  verified: { tone: 'success', label: 'status.verified' },
  rejected: { tone: 'danger', label: 'status.rejected' },
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
