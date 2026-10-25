import { Badge, CommunityListing, LeaderboardUser, RepairStory, Technician } from '../types';

/**
 * Category Fallback Images & Neutral Placeholders
 * Used whenever an item image is missing or fails to load, guaranteeing
 * clean, category-accurate visuals with zero mismatched images.
 */
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  'Photography & Gear': 'https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?w=600&auto=format&fit=crop&q=80',
  'Home Appliances': 'https://images.unsplash.com/photo-1618941716939-553df3c6c278?w=600&auto=format&fit=crop&q=80',
  'Kitchen Appliances': 'https://images.unsplash.com/photo-1585670149967-b4f4da88cc9f?w=600&auto=format&fit=crop&q=80',
  'Furniture & Decor': 'https://images.unsplash.com/photo-1580481077195-c228303d8392?w=600&auto=format&fit=crop&q=80',
  'Electronics & Media': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  'Tools & DIY': 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80',
  'Sports & Outdoors': 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=80',
  'Books & Hobby': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80',
};

export function getCategoryFallbackImage(category?: string): string {
  if (!category) return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80';
  return CATEGORY_FALLBACK_IMAGES[category] || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80';
}

/**
 * Empty Community Listings array (All listings load dynamically from Supabase)
 */
export const SEEDED_LISTINGS: CommunityListing[] = [];

/**
 * Local Specialist Repair Technicians (for direct local technician booking)
 */
export const SEEDED_TECHNICIANS: Technician[] = [
  {
    id: 'tech-1',
    name: 'Suresh Electric & Motor Works',
    specialty: 'Fans, Mixers, Toasters & Small Appliances',
    rating: 4.9,
    reviewsCount: 142,
    priceRange: '₹150 - ₹450',
    distance: '0.8 km away',
    turnaround: 'Same day (2-4 hrs)',
    verifiedBadge: true,
    phone: '+91 98450 21345',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'tech-2',
    name: 'Master Ji Precision Wood & Hardware',
    specialty: 'Furniture Reglueing, Hinges, Chairs & Desks',
    rating: 4.8,
    reviewsCount: 98,
    priceRange: '₹200 - ₹600',
    distance: '1.4 km away',
    turnaround: '24-48 hrs',
    verifiedBadge: true,
    phone: '+91 98452 78910',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'tech-3',
    name: 'CircuitGenie Digital Repair Lab',
    specialty: 'Soldering, Audio Gear, Power Supplies & Lenses',
    rating: 4.9,
    reviewsCount: 215,
    priceRange: '₹300 - ₹850',
    distance: '1.9 km away',
    turnaround: '1-2 days',
    verifiedBadge: true,
    phone: '+91 98455 45678',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
];

export const SEEDED_REPAIR_STORIES: RepairStory[] = [];
export const SEEDED_LEADERBOARD: LeaderboardUser[] = [];

/**
 * INITIAL USER BADGES
 * All start unlocked = false for realistic user onboarding.
 */
export const INITIAL_BADGES: Badge[] = [
  {
    id: 'badge-1',
    name: 'First Repair',
    description: 'Diagnosed or repaired your first household item instead of binning it.',
    icon: 'Wrench',
    unlocked: false,
  },
  {
    id: 'badge-2',
    name: 'Sharing Star',
    description: 'Listed an item for borrowing or fulfilled a neighbor request.',
    icon: 'Share2',
    unlocked: false,
  },
  {
    id: 'badge-3',
    name: 'Waste Warrior',
    description: 'Diverted over 10 kg of material waste from municipal landfill.',
    icon: 'ShieldCheck',
    unlocked: false,
  },
  {
    id: 'badge-4',
    name: 'Circular Pioneer',
    description: 'Completed actions across all circular paths: Repair, Borrow, Donate, Repurpose, or Replace smartly.',
    icon: 'RotateCw',
    unlocked: false,
  },
  {
    id: 'badge-5',
    name: 'Zero Waste Champion',
    description: 'Saved more than 50 kg of CO2 equivalent emissions in the community.',
    icon: 'Award',
    unlocked: false,
  },
];
