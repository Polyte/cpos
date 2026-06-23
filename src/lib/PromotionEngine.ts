// Roxton POS - Multi-Buy Promotion Engine
// Supports: Buy X Get Y Free, Volume Discounts, Percentage Off, Bundle Pricing

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface Promotion {
  id: string;
  name: string;
  type: 'buy_x_get_y' | 'volume_discount' | 'percent_off' | 'bundle';
  rules: {
    buyQuantity?: number;
    freeQuantity?: number;
    targetItems?: string[];       // product IDs
    targetCategories?: string[];  // category names
    minQuantity?: number;
    discountPercent?: number;
    bundleItems?: string[];
    bundlePrice?: number;
  };
  active: boolean;
  badge: string;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  itemId: string;
  itemName: string;
  discount: number;
  badge: string;
}

export interface PromotionResult {
  applied: AppliedPromotion[];
  totalDiscount: number;
  itemBadges: Record<string, string[]>; // itemId -> badge strings
}

// Demo promotions for the Roxton retail environment
const DEMO_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-b2g1-milk',
    name: 'Buy 2 Get 1 Free - Luxury Milk',
    type: 'buy_x_get_y',
    rules: { buyQuantity: 2, freeQuantity: 1, targetItems: ['P1'] },
    active: true,
    badge: 'BUY 2 GET 1 FREE'
  },
  {
    id: 'promo-vol-bread',
    name: '10% Off 3+ Wheat Bread',
    type: 'volume_discount',
    rules: { minQuantity: 3, discountPercent: 10, targetItems: ['P2'] },
    active: true,
    badge: '10% OFF 3+'
  },
  {
    id: 'promo-fuel-bulk',
    name: '5% Off 50L+ Fuel',
    type: 'volume_discount',
    rules: { minQuantity: 50, discountPercent: 5, targetItems: ['P3'] },
    active: true,
    badge: '5% OFF BULK'
  },
  {
    id: 'promo-parts-discount',
    name: '15% Off 2+ Brake Pad Sets',
    type: 'volume_discount',
    rules: { minQuantity: 2, discountPercent: 15, targetItems: ['P4'] },
    active: true,
    badge: '15% OFF 2+'
  }
];

function matchesTarget(item: CartItem, promo: Promotion): boolean {
  if (promo.rules.targetItems?.length) {
    return promo.rules.targetItems.includes(item.id);
  }
  if (promo.rules.targetCategories?.length) {
    return promo.rules.targetCategories.includes(item.category || '');
  }
  return true; // No target restriction = applies to all
}

export function calculatePromotions(
  cart: CartItem[],
  promotions: Promotion[] = DEMO_PROMOTIONS
): PromotionResult {
  const applied: AppliedPromotion[] = [];
  let totalDiscount = 0;
  const itemBadges: Record<string, string[]> = {};

  for (const promo of promotions.filter(p => p.active)) {
    for (const item of cart) {
      if (!matchesTarget(item, promo)) continue;

      let discount = 0;

      switch (promo.type) {
        case 'buy_x_get_y': {
          const buy = promo.rules.buyQuantity || 2;
          const free = promo.rules.freeQuantity || 1;
          const totalPerSet = buy + free;
          const completeSets = Math.floor(item.quantity / totalPerSet);
          if (completeSets > 0) {
            discount = completeSets * free * item.price;
          }
          break;
        }

        case 'volume_discount': {
          const minQty = promo.rules.minQuantity || 1;
          if (item.quantity >= minQty) {
            const pct = promo.rules.discountPercent || 0;
            discount = (item.price * item.quantity) * (pct / 100);
          }
          break;
        }

        case 'percent_off': {
          const pct = promo.rules.discountPercent || 0;
          discount = (item.price * item.quantity) * (pct / 100);
          break;
        }

        case 'bundle': {
          // Bundle: if all bundleItems are in cart, apply bundle price
          const bundleItems = promo.rules.bundleItems || [];
          const allPresent = bundleItems.every(bid => cart.some(c => c.id === bid));
          if (allPresent && bundleItems.includes(item.id)) {
            const normalTotal = bundleItems.reduce((sum, bid) => {
              const ci = cart.find(c => c.id === bid);
              return sum + (ci ? ci.price : 0);
            }, 0);
            const bundlePrice = promo.rules.bundlePrice || normalTotal;
            // Split discount proportionally across bundle items
            discount = (normalTotal - bundlePrice) * (item.price / normalTotal);
          }
          break;
        }
      }

      if (discount > 0) {
        discount = Math.round(discount * 100) / 100; // Round to cents
        applied.push({
          promotionId: promo.id,
          promotionName: promo.name,
          itemId: item.id,
          itemName: item.name,
          discount,
          badge: promo.badge
        });
        totalDiscount += discount;

        if (!itemBadges[item.id]) itemBadges[item.id] = [];
        itemBadges[item.id].push(promo.badge);
      }
    }
  }

  return {
    applied,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    itemBadges
  };
}

export { DEMO_PROMOTIONS };
