/**
 * Module registry — single source of truth for all features.
 * Disabled modules are documented here but not rendered in the UI.
 * See docs/decisions/01-config-driven-modules.md
 */

export interface Module {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  phase: number;
  path: string;
  icon: string;
}

export const modules: Module[] = [
  {
    id: 'dashboard',
    name: "Today's Tasks",
    description: 'Daily follow-ups, cold lead alerts, quick stats',
    enabled: true,
    phase: 1,
    path: '/',
    icon: 'layout-dashboard',
  },
  {
    id: 'crm',
    name: 'Leads',
    description: 'Lead management, search, filter, and capture',
    enabled: true,
    phase: 1,
    path: '/leads',
    icon: 'users',
  },
  {
    id: 'pipeline',
    name: 'Pipeline',
    description: 'Kanban board — drag leads through stages',
    enabled: true,
    phase: 1,
    path: '/pipeline',
    icon: 'kanban',
  },
  {
    id: 'market-intelligence',
    name: 'Intelligence',
    description: 'DLD price index, upgrade calculator, market trends',
    enabled: true,
    phase: 1,
    path: '/intelligence',
    icon: 'bar-chart-2',
  },
  {
    id: 'apollo',
    name: 'Lead Generation',
    description: 'Auto-source leads from Apollo API and DLD transactions',
    enabled: false,
    phase: 2,
    path: '/lead-generation',
    icon: 'zap',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Capture',
    description: 'Auto-create leads from WhatsApp messages',
    enabled: false,
    phase: 2,
    path: '/whatsapp',
    icon: 'message-circle',
  },
  {
    id: 'portal-sync',
    name: 'Portal Sync',
    description: 'Sync leads from Bayut and Property Finder',
    enabled: false,
    phase: 2,
    path: '/portal-sync',
    icon: 'refresh-cw',
  },
  {
    id: 'email-outreach',
    name: 'Email Outreach',
    description: 'Automated email sequences for lead nurturing',
    enabled: false,
    phase: 2,
    path: '/email-outreach',
    icon: 'send',
  },
  {
    id: 'arabic-rtl',
    name: 'Arabic / RTL',
    description: 'Full Arabic language support with RTL layout',
    enabled: false,
    phase: 3,
    path: '/settings/language',
    icon: 'globe',
  },
];

/** Get only enabled modules */
export const enabledModules = modules.filter((m) => m.enabled);

/** Get the nav modules (enabled, phase 1, shown in nav) */
export const navModules = enabledModules;
