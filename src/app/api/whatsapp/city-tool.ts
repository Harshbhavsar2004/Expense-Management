const TIER_I_CITIES = [
  "mumbai", "delhi", "bengaluru", "bangalore", "chennai", "hyderabad", 
  "ahmedabad", "kolkata", "pune"
];

const TIER_II_CITIES = [
  "amritsar", "bhopal", "bhubaneswar", "chandigarh", "coimbatore", 
  "dehradun", "gandhinagar", "gwalior", "hubli", "indore", "jabalpur", 
  "jaipur", "jalandhar", "jammu", "jamshedpur", "kanpur", "kochi", 
  "kozhikode", "lucknow", "ludhiana", "madurai", "mangalore", "meerut", 
  "mysore", "nagpur", "nashik", "navi mumbai", "panaji", "patna", 
  "pondicherry", "raipur", "rajkot", "ranchi", "salem", "surat", 
  "thiruvananthapuram", "tiruchirappalli", "tiruppur", "udaipur", 
  "vadodara", "varanasi", "vijayawada", "visakhapatnam", "warangal"
];

export function getCityTier(cityName: string): "Tier - I" | "Tier - II" | "Tier - III" {
  const normalized = cityName.toLowerCase().trim();
  
  if (TIER_I_CITIES.some(city => normalized.includes(city))) {
    return "Tier - I";
  }
  
  if (TIER_II_CITIES.some(city => normalized.includes(city))) {
    return "Tier - II";
  }
  
  return "Tier - III";
}
