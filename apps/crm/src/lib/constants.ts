/**
 * Application-wide constants — Dubai areas, lead options, etc.
 */

export const DUBAI_AREAS = [
  'Downtown Dubai',
  'Business Bay',
  'DIFC',
  'Dubai Marina',
  'JBR (Jumeirah Beach Residence)',
  'Palm Jumeirah',
  'Jumeirah Lake Towers (JLT)',
  'Jumeirah Village Circle (JVC)',
  'Jumeirah Village Triangle (JVT)',
  'Al Barsha',
  'Arabian Ranches',
  'Dubai Hills Estate',
  'Mudon',
  'Damac Hills',
  'Emirates Hills',
  'Jumeirah Golf Estates',
  'Mirdif',
  'Silicon Oasis',
  'International City',
  'Discovery Gardens',
  'Motor City',
  'Sports City',
  'Remraam',
  'The Springs',
  'The Meadows',
  'The Lakes',
  'The Greens',
  'Al Furjan',
  'Town Square',
  'Serena',
  'Tilal Al Ghaf',
  'MBR City',
  'Creek Harbour',
  'Sobha Hartland',
  'Dubai South',
  'Al Jaddaf',
  'Ras Al Khor',
  'Deira',
  'Bur Dubai',
  'Karama',
  'Satwa',
  'Jumeirah 1/2/3',
  'Umm Suqeim',
  'Al Safa',
  'City Walk',
  'Bluewaters Island',
  'La Mer',
  'Port de La Mer',
];

export const LEAD_SOURCES = [
  { value: 'family', label: 'Family' },
  { value: 'friend', label: 'Friend' },
  { value: 'referral', label: 'Referral' },
  { value: 'bayut', label: 'Bayut' },
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'apollo', label: 'Apollo' },
  { value: 'dld', label: 'DLD' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
] as const;

export const LEAD_TYPES = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'landlord', label: 'Landlord' },
] as const;

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
] as const;

export const BEDROOM_OPTIONS = [
  { value: 'studio', label: 'Studio' },
  { value: '1', label: '1 BR' },
  { value: '2', label: '2 BR' },
  { value: '3', label: '3 BR' },
  { value: '4+', label: '4+ BR' },
] as const;

export const INTERACTION_TYPES = [
  { value: 'call', label: 'Call', icon: 'phone' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'viewing', label: 'Viewing', icon: 'home' },
  { value: 'meeting', label: 'Meeting', icon: 'users' },
  { value: 'note', label: 'Note', icon: 'file-text' },
] as const;

export const INTERACTION_OUTCOMES = [
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'no_answer', label: 'No Answer' },
] as const;

export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
] as const;

/** Cold lead threshold in days */
export const COLD_LEAD_DAYS = 7;

/** Rate limit: AI calls per user per hour */
export const AI_RATE_LIMIT = 20;
