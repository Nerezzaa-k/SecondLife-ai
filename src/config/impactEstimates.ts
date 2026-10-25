/**
 * Phase 4: Documented Per-Category Impact Estimations & Methodology Assumptions
 *
 * Used when Gemini multimodal diagnostics is offline or returns partial null estimates.
 * All numbers are grounded in lifecycle analysis (LCA) averages:
 * - Waste (kg): Average mass of functional item diverted from municipal landfill.
 * - CO2e (kg): Embodied greenhouse gas emissions avoided by extending the item's life
 *   rather than manufacturing, packaging, and shipping a new replacement.
 * - Money Saved (₹): Estimated avoided consumer replacement purchase cost in India.
 */

export interface CategoryDefaultEstimate {
  category: string;
  averageWeightKg: number;
  embodiedCo2FactorKg: number; // kg CO2e per item lifecycle extension
  typicalReplacementPriceInr: number;
  typicalRepairCostInr: number;
  methodologyNote: string;
}

export const CATEGORY_IMPACT_DEFAULTS: Record<string, CategoryDefaultEstimate> = {
  'Photography & Gear': {
    category: 'Photography & Gear',
    averageWeightKg: 1.8,
    embodiedCo2FactorKg: 16.5,
    typicalReplacementPriceInr: 6500,
    typicalRepairCostInr: 950,
    methodologyNote: 'High semiconductor and optical glass density yields high embodied carbon per kilogram.',
  },
  'Home Appliances': {
    category: 'Home Appliances',
    averageWeightKg: 4.2,
    embodiedCo2FactorKg: 22.0,
    typicalReplacementPriceInr: 4200,
    typicalRepairCostInr: 650,
    methodologyNote: 'Electric motors, copper wiring, and metal chassis divert substantial landfill volume.',
  },
  'Kitchen Appliances': {
    category: 'Kitchen Appliances',
    averageWeightKg: 3.0,
    embodiedCo2FactorKg: 18.0,
    typicalReplacementPriceInr: 3200,
    typicalRepairCostInr: 500,
    methodologyNote: 'Heating elements and stainless-steel housings avoid heavy smelting footprint.',
  },
  'Furniture & Decor': {
    category: 'Furniture & Decor',
    averageWeightKg: 8.5,
    embodiedCo2FactorKg: 32.0,
    typicalReplacementPriceInr: 5500,
    typicalRepairCostInr: 800,
    methodologyNote: 'Engineered timber and upholstery retention prevents bulk municipal waste buildup.',
  },
  'Electronics & Media': {
    category: 'Electronics & Media',
    averageWeightKg: 2.2,
    embodiedCo2FactorKg: 28.0,
    typicalReplacementPriceInr: 7500,
    typicalRepairCostInr: 1200,
    methodologyNote: 'PCB boards and lithium batteries possess the highest lifecycle carbon intensity.',
  },
  'Tools & DIY': {
    category: 'Tools & DIY',
    averageWeightKg: 2.8,
    embodiedCo2FactorKg: 15.0,
    typicalReplacementPriceInr: 2800,
    typicalRepairCostInr: 450,
    methodologyNote: 'Forged steel and power tool armatures last decades when properly serviced.',
  },
  'Sports & Outdoors': {
    category: 'Sports & Outdoors',
    averageWeightKg: 3.5,
    embodiedCo2FactorKg: 14.0,
    typicalReplacementPriceInr: 2500,
    typicalRepairCostInr: 400,
    methodologyNote: 'Alloy frames and composite gear prevent petrochemical and synthetic polymer waste.',
  },
  'Books & Hobby': {
    category: 'Books & Hobby',
    averageWeightKg: 0.8,
    embodiedCo2FactorKg: 2.5,
    typicalReplacementPriceInr: 750,
    typicalRepairCostInr: 100,
    methodologyNote: 'Paper and binding reuse saves pulping water and bleaching emissions.',
  },
  'Other': {
    category: 'Other',
    averageWeightKg: 2.0,
    embodiedCo2FactorKg: 10.0,
    typicalReplacementPriceInr: 1800,
    typicalRepairCostInr: 350,
    methodologyNote: 'General household item circular conservation average.',
  },
};

/**
 * Resolves reliable impact estimate for any category and action
 */
export function getCategoryImpactEstimate(
  categoryName?: string,
  actionType: 'repaired' | 'donated' | 'borrowed' | 'lent' | 'repurposed' = 'repaired'
): {
  wasteKg: number;
  co2Kg: number;
  moneySavedInr: number;
  source: 'category_default';
} {
  const match = (categoryName && CATEGORY_IMPACT_DEFAULTS[categoryName]) || CATEGORY_IMPACT_DEFAULTS['Other'];

  if (actionType === 'repaired') {
    return {
      wasteKg: match.averageWeightKg,
      co2Kg: match.embodiedCo2FactorKg,
      moneySavedInr: match.typicalReplacementPriceInr - match.typicalRepairCostInr,
      source: 'category_default',
    };
  }

  if (actionType === 'borrowed' || actionType === 'lent') {
    return {
      wasteKg: parseFloat((match.averageWeightKg * 0.7).toFixed(1)),
      co2Kg: parseFloat((match.embodiedCo2FactorKg * 0.7).toFixed(1)),
      moneySavedInr: Math.round(match.typicalReplacementPriceInr * 0.4),
      source: 'category_default',
    };
  }

  // donated or repurposed
  return {
    wasteKg: match.averageWeightKg,
    co2Kg: parseFloat((match.embodiedCo2FactorKg * 0.85).toFixed(1)),
    moneySavedInr: 0,
    source: 'category_default',
  };
}
