export type StarterBrand = {
  readonly name: string;
  readonly category: string;
  readonly avgDiscountPercent: number;
  readonly verificationWindowHours: number;
  readonly autoVerifyEnabled: boolean;
};

export const starterCatalog: readonly StarterBrand[] = [
  {
    name: 'Amazon',
    category: 'Shopping',
    avgDiscountPercent: 12,
    verificationWindowHours: 2,
    autoVerifyEnabled: true
  },
  {
    name: 'Flipkart',
    category: 'Shopping',
    avgDiscountPercent: 10,
    verificationWindowHours: 2,
    autoVerifyEnabled: true
  },
  {
    name: 'Myntra',
    category: 'Fashion',
    avgDiscountPercent: 18,
    verificationWindowHours: 3,
    autoVerifyEnabled: false
  },
  {
    name: 'Ajio',
    category: 'Fashion',
    avgDiscountPercent: 18,
    verificationWindowHours: 3,
    autoVerifyEnabled: false
  },
  {
    name: 'Nykaa',
    category: 'Beauty',
    avgDiscountPercent: 14,
    verificationWindowHours: 3,
    autoVerifyEnabled: false
  },
  {
    name: 'Sephora',
    category: 'Beauty',
    avgDiscountPercent: 12,
    verificationWindowHours: 3,
    autoVerifyEnabled: false
  },
  {
    name: 'Swiggy',
    category: 'Food',
    avgDiscountPercent: 15,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  },
  {
    name: 'Zomato',
    category: 'Food',
    avgDiscountPercent: 15,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  },
  {
    name: 'Uber',
    category: 'Mobility',
    avgDiscountPercent: 10,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  },
  {
    name: 'Ola',
    category: 'Mobility',
    avgDiscountPercent: 10,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  },
  {
    name: 'MakeMyTrip',
    category: 'Travel',
    avgDiscountPercent: 8,
    verificationWindowHours: 4,
    autoVerifyEnabled: false
  },
  {
    name: 'Yatra',
    category: 'Travel',
    avgDiscountPercent: 9,
    verificationWindowHours: 4,
    autoVerifyEnabled: false
  },
  {
    name: 'Cleartrip',
    category: 'Travel',
    avgDiscountPercent: 9,
    verificationWindowHours: 4,
    autoVerifyEnabled: false
  },
  {
    name: 'BookMyShow',
    category: 'Entertainment',
    avgDiscountPercent: 12,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  },
  {
    name: 'PVR',
    category: 'Entertainment',
    avgDiscountPercent: 11,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  },
  {
    name: 'Steam',
    category: 'Gaming',
    avgDiscountPercent: 7,
    verificationWindowHours: 1,
    autoVerifyEnabled: false
  },
  {
    name: 'PlayStation Store',
    category: 'Gaming',
    avgDiscountPercent: 8,
    verificationWindowHours: 1,
    autoVerifyEnabled: false
  },
  {
    name: 'Google Play',
    category: 'Digital',
    avgDiscountPercent: 7,
    verificationWindowHours: 1,
    autoVerifyEnabled: false
  },
  {
    name: 'Apple App Store',
    category: 'Digital',
    avgDiscountPercent: 6,
    verificationWindowHours: 1,
    autoVerifyEnabled: false
  },
  {
    name: 'BigBasket',
    category: 'Groceries',
    avgDiscountPercent: 9,
    verificationWindowHours: 2,
    autoVerifyEnabled: false
  }
] as const;
