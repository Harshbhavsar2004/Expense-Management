
const MERCHANT_CATEGORIES: Record<string, string> = {
  // Meals
  "swiggy": "Meals",
  "zomato": "Meals",
  "instamart": "Meals",
  "blinkit": "Meals",
  "bigbasket": "Meals",
  "zepto": "Meals",
  "restaurant": "Meals",
  "cafe": "Meals",
  "dining": "Meals",
  "food": "Meals",
  "bakery": "Meals",
  "sweets": "Meals",
  "kfc": "Meals",
  "mcdonald": "Meals",
  "burger": "Meals",
  "starbucks": "Meals",
  "pizza": "Meals",

  // Travel Expenses
  "travel": "Travel Expenses",
  "flight": "Travel Expenses",
  "indigo": "Travel Expenses",
  "airindia": "Travel Expenses",
  "spicejet": "Travel Expenses",
  "vistara": "Travel Expenses",
  "akasa": "Travel Expenses",
  "uber": "Travel Expenses",
  "ola": "Travel Expenses",
  "rapido": "Travel Expenses",
  "yatri": "Travel Expenses",
  "taxi": "Travel Expenses",
  "cab": "Travel Expenses",
  "meru": "Travel Expenses",
  "blusmart": "Travel Expenses",
  "rail": "Travel Expenses",
  "irctc": "Travel Expenses",
  "train": "Travel Expenses",
  "bus": "Travel Expenses",
  "redbus": "Travel Expenses",
  "parking": "Travel Expenses",
  "toll": "Travel Expenses",

  // Hotel Accommodation
  "hotel": "Hotel Accommodation",
  "stay": "Hotel Accommodation",
  "oyo": "Hotel Accommodation",
  "airbnb": "Hotel Accommodation",
  "lodging": "Hotel Accommodation",
  "resort": "Hotel Accommodation",
  "mmyt": "Hotel Accommodation",
  "makemytrip": "Hotel Accommodation",
  "goibibo": "Hotel Accommodation",

  // Office & Comm
  "amazon": "Office Supplies",
  "flipkart": "Office Supplies",
  "reliance": "Office Supplies",
  "jio": "Communication",
  "airtel": "Communication",
  "vi": "Communication",
};

/**
 * Predicts the category of a merchant based on its name.
 * In a real-world scenario, this could call an LLM or use a more robust fuzzy matching library.
 */
export function getMerchantCategory(merchantName: string): string {
  if (!merchantName) return "Miscellaneous";
  
  const normalized = merchantName.toLowerCase();
  
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORIES)) {
    if (normalized.includes(keyword)) {
      return category;
    }
  }
  
  return "Miscellaneous";
}
