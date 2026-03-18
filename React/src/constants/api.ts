// CoachFit platform API
export const COACHFIT_API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://gcgyms.com';

export const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.net/api/v2/product';

export const PRODUCT_FIELDS = [
  'product_name',
  'brands',
  'image_url',
  'serving_size',
  'serving_quantity',
  'product_quantity',
  'nutriments',
].join(',');

export const SUPPORTED_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
] as const;

export const BARCODE_SCAN_DEBOUNCE_MS = 2000;
