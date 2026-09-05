export const mockCreatives = [
  {
    id: 'cr-1',
    name: 'Sunday Night Showdown - V1',
    thumbnail: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=800&auto=format&fit=crop&q=80',
    campaign: 'Matchday Series Oct',
    format: '1080x1080 (Social)',
    status: 'Ready',
    compliance: 'Verified',
    createdAt: '2024-10-14 10:30'
  },
  {
    id: 'cr-2',
    name: 'Premier League Accumulator',
    thumbnail: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80',
    campaign: 'Season Launch 24',
    format: '1080x1920 (Story)',
    status: 'Ready',
    compliance: 'Verified',
    createdAt: '2024-10-14 09:15'
  },
  {
    id: 'cr-3',
    name: 'Casino Welcome Bonus Redux',
    thumbnail: 'https://images.unsplash.com/photo-1596838132731-16013b044c10?w=800&auto=format&fit=crop&q=80',
    campaign: 'Casino Acquisition',
    format: '1200x628 (Display)',
    status: 'Review Required',
    compliance: 'Flagged',
    createdAt: '2024-10-13 16:45'
  },
  {
    id: 'cr-4',
    name: 'NBA Tip-off Countdown',
    thumbnail: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80',
    campaign: 'Basketball Early Bird',
    format: '1080x1080 (Social)',
    status: 'Processing',
    compliance: 'Pending',
    createdAt: '2024-10-15 11:20'
  }
];

export const mockCampaigns = [
  {
    id: 'cp-1',
    name: 'Matchday Series Oct',
    type: 'Matchday Campaign',
    status: 'Active',
    creativeCount: 24,
    lastUpdated: '2 hours ago',
    region: 'US / Northeast'
  },
  {
    id: 'cp-2',
    name: 'Casino Acquisition',
    type: 'Bonus Announcement',
    status: 'Active',
    creativeCount: 12,
    lastUpdated: '1 day ago',
    region: 'Global / Multi-state'
  },
  {
    id: 'cp-3',
    name: 'Seasonal Slots 2024',
    type: 'Seasonal Sports',
    status: 'Draft',
    creativeCount: 0,
    lastUpdated: '3 days ago',
    region: 'US / West'
  },
  {
    id: 'cp-4',
    name: 'Affiliate Q4 Boost',
    type: 'Affiliate Promotion',
    status: 'Completed',
    creativeCount: 48,
    lastUpdated: '1 week ago',
    region: 'EU / Regulated'
  }
];

export const teamMembers = [
  { id: 'u-1', name: 'Alex Rivera', email: 'alex@company.com', role: 'Admin', status: 'Active' },
  { id: 'u-2', name: 'Sarah Chen', email: 'sarah@company.com', role: 'Designer', status: 'Active' },
  { id: 'u-3', name: 'James Stratton', email: 'james@company.com', role: 'Marketing Manager', status: 'Active' },
  { id: 'u-4', name: 'David Miller', email: 'david@company.com', role: 'Compliance Reviewer', status: 'Away' },
  { id: 'u-5', name: 'Emma Wilson', email: 'emma@company.com', role: 'Viewer', status: 'Active' },
];

export const mockWinningStatics = [
  {
    id: 'ws-1',
    name: 'High-Heat Sunday NFL',
    url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
    performance: '3.4% CTR',
    category: 'Sportsbook'
  },
  {
    id: 'ws-2',
    name: 'Neon Casino Premium',
    url: 'https://images.unsplash.com/photo-1596838132731-16013b044c10?w=800&q=80',
    performance: '2.8% CTR',
    category: 'Casino'
  },
  {
    id: 'ws-3',
    name: 'Matchday Hype - Blue',
    url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    performance: '4.1% CTR',
    category: 'Matchday'
  },
  {
    id: 'ws-4',
    name: 'Live Odds Overlay Est',
    url: 'https://images.unsplash.com/photo-1524749292158-7540c2494485?w=800&q=80',
    performance: '3.9% CTR',
    category: 'In-Play'
  }
];

export const mockDisclaimers = [
  { id: 'dc-1', text: '18+ Please gamble responsibly. T&Cs apply.', category: 'Compliance' },
  { id: 'dc-2', text: 'New customers only. Min deposit £10. Max bonus £50.', category: 'Promotional' },
  { id: 'dc-3', text: 'Participate responsibly. Visit begambleaware.org for help.', category: 'Responsible Gaming' }
];

export const usageData = {
  credits: {
    total: 5000,
    used: 1240,
    remaining: 3760
  },
  generations: 1240,
  activeGenerations: 8,
  exports: 850
};
