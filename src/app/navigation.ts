/**
 * The panel's information architecture (FR-W-069, ADR-W28; FR-W-075, ADR-W32): the ONLY list of sidebar sections.
 * Each section is a foldable sidebar submenu listing its pages ("tabs" below). Tabs are the features' own routes, so
 * every page keeps its own URL and query state and every old link still opens the same page. A feature route that is in no section shows as its own sidebar
 * item (Overview today), so a new feature appears in the nav until it is placed here.
 *
 * Gating stays per tab: a tab shows only when its feature's flag is on and the user holds its permission; a section
 * with no visible tab is hidden; a section with one visible tab is a plain sidebar item.
 */
import { Banknote, ClipboardList, Inbox, Settings2, UsersRound, ChartColumn, UserRound } from 'lucide-react';
import { registerSections } from '@/shared/feature/registry';
import type { SectionDef } from '@/shared/feature/types';
import './features';

export const sections: SectionDef[] = [
  { id: 'inbox', title: 'shell:sections.inbox', icon: Inbox, group: 'top', order: 2, tabs: ['/inbox', '/requests', '/activity', '/notices'], badgeFrom: ['/inbox', '/requests'] },
  {
    id: 'customers', title: 'shell:sections.customers', icon: UserRound, group: 'field', order: 10,
    tabs: ['/customers', '/map', '/pin-approvals', '/prospects', '/areas', '/data-quality'],
    badgeFrom: ['/pin-approvals'],
  },
  {
    id: 'collections', title: 'shell:sections.collections', icon: Banknote, group: 'field', order: 20,
    tabs: ['/collections', '/collections/conflicts', '/cash', '/handovers'],
    badgeFrom: ['/collections/conflicts', '/handovers'],
  },
  {
    id: 'field', title: 'shell:sections.field', icon: ClipboardList, group: 'field', order: 30,
    tabs: ['/visits', '/cowork', '/promises', '/tasks', '/places'],
    badgeFrom: ['/tasks', '/places'],
  },
  {
    id: 'staff', title: 'shell:sections.staff', icon: UsersRound, group: 'field', order: 40,
    tabs: ['/staff', '/attendance', '/attendance/leave', '/live', '/routes', '/leaderboard', '/targets'],
    badgeFrom: ['/attendance/leave'],
  },
  { id: 'reports', title: 'shell:sections.reports', icon: ChartColumn, group: 'insights', order: 50, tabs: ['/reports'] },
  {
    id: 'admin', title: 'shell:sections.admin', icon: Settings2, group: 'admin', order: 60,
    tabs: ['/admin/users', '/admin/devices', '/admin/permissions', '/admin/settings', '/attendance/calendar', '/admin/flags', '/admin/audit', '/admin/photos', '/admin/system'],
    badgeFrom: ['/admin/devices', '/admin/photos'],
  },
];

registerSections(sections);
