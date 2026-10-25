import { UserStats } from '../types';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'repair' | 'sharing' | 'waste' | 'circularity' | 'trust' | 'carbon';
  icon: string; // Lucide icon name
  threshold: number;
  unit: string;
  calculateProgress: (
    stats: UserStats,
    community: { averageRating: number; totalReviews: number }
  ) => {
    current: number;
    target: number;
    percentage: number;
    unlocked: boolean;
  };
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'badge-1',
    name: 'First Repair',
    description: 'Diagnosed and repaired your first household item instead of throwing it away.',
    category: 'repair',
    icon: 'Wrench',
    threshold: 1,
    unit: 'repair',
    calculateProgress: (stats) => {
      const current = stats.repairsDone || 0;
      const target = 1;
      return {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unlocked: current >= target,
      };
    },
  },
  {
    id: 'badge-2',
    name: 'Sharing Star',
    description: 'Circulated items with neighbors through 3 completed lends or pass-along donations.',
    category: 'sharing',
    icon: 'Share2',
    threshold: 3,
    unit: 'exchanges',
    calculateProgress: (stats) => {
      const current = (stats.donationsDone || 0) + (stats.borrowedCount || 0);
      const target = 3;
      return {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unlocked: current >= target,
      };
    },
  },
  {
    id: 'badge-3',
    name: 'Waste Warrior',
    description: 'Diverted at least 10 kg of material waste from local municipal landfills.',
    category: 'waste',
    icon: 'ShieldCheck',
    threshold: 10,
    unit: 'kg waste',
    calculateProgress: (stats) => {
      const current = parseFloat((stats.kgWasteSaved || 0).toFixed(1));
      const target = 10;
      return {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unlocked: current >= target,
      };
    },
  },
  {
    id: 'badge-4',
    name: 'Circular Pioneer',
    description: 'Completed 5 distinct circular actions across repairs, shares, or donations.',
    category: 'circularity',
    icon: 'RotateCw',
    threshold: 5,
    unit: 'actions',
    calculateProgress: (stats) => {
      const current = stats.itemsReused || 0;
      const target = 5;
      return {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unlocked: current >= target,
      };
    },
  },
  {
    id: 'badge-5',
    name: 'Five-Star Neighbor',
    description: 'Maintained an exemplary community rating of 4.5+ with at least 3 neighbor reviews.',
    category: 'trust',
    icon: 'Star',
    threshold: 3,
    unit: 'reviews (4.5★+)',
    calculateProgress: (_stats, community) => {
      const totalReviews = community.totalReviews || 0;
      const avg = community.averageRating || 0;
      const target = 3;
      const meetsRating = avg >= 4.5 || (totalReviews === 0 && avg === 5.0);
      const current = meetsRating ? totalReviews : 0;
      return {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unlocked: meetsRating && totalReviews >= target,
      };
    },
  },
  {
    id: 'badge-6',
    name: 'Zero Waste Champion',
    description: 'Prevented over 25 kg of embodied CO2 emissions from entering the atmosphere.',
    category: 'carbon',
    icon: 'Award',
    threshold: 25,
    unit: 'kg CO2',
    calculateProgress: (stats) => {
      const current = parseFloat((stats.co2Saved || 0).toFixed(1));
      const target = 25;
      return {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unlocked: current >= target,
      };
    },
  },
];
