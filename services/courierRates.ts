
export type Region = 'D' | 'E' | '9' | 'F';

export const COURIER_REGIONS: Region[] = ['D', 'E', '9', 'F'];

// Weight steps up to 30kg (Fixed Price)
export const COURIER_FIXED_RATES: Record<string, Record<Region, number>> = {
  "0.5": { D: 40.92, E: 43.27, "9": 18.74, F: 48.36 },
  "1":   { D: 55.14, E: 58.52, "9": 19.10, F: 64.63 },
  "1.5": { D: 65.86, E: 69.97, "9": 22.46, F: 76.83 },
  "2":   { D: 76.58, E: 81.42, "9": 25.83, F: 89.03 },
  "2.5": { D: 87.30, E: 92.87, "9": 29.46, F: 101.23 },
  "3":   { D: 93.64, E: 100.50, "9": 29.71, F: 109.88 },
  "3.5": { D: 99.98, E: 108.13, "9": 32.72, F: 118.53 },
  "4":   { D: 106.32, E: 115.76, "9": 35.97, F: 127.18 },
  "4.5": { D: 112.66, E: 123.39, "9": 39.20, F: 135.83 },
  "5":   { D: 119.00, E: 131.02, "9": 42.45, F: 144.48 },
  "5.5": { D: 124.87, E: 138.15, "9": 46.31, F: 152.67 },
  "6":   { D: 130.74, E: 145.28, "9": 48.02, F: 160.86 },
  "6.5": { D: 136.61, E: 152.41, "9": 49.75, F: 169.05 },
  "7":   { D: 142.48, E: 159.54, "9": 51.46, F: 177.24 },
  "7.5": { D: 148.35, E: 166.67, "9": 53.19, F: 185.43 },
  "8":   { D: 154.22, E: 173.80, "9": 54.90, F: 193.62 },
  "8.5": { D: 160.09, E: 180.93, "9": 56.63, F: 201.81 },
  "9":   { D: 165.96, E: 188.06, "9": 58.34, F: 210.00 },
  "9.5": { D: 171.83, E: 195.19, "9": 60.07, F: 218.19 },
  "10":  { D: 177.70, E: 202.32, "9": 61.78, F: 226.38 },
  "10.5":{ D: 183.35, E: 208.95, "9": 64.71, F: 234.30 },
  "11":  { D: 189.00, E: 215.58, "9": 67.64, F: 242.22 },
  "11.5":{ D: 194.65, E: 222.21, "9": 70.57, F: 250.14 },
  "12":  { D: 200.30, E: 228.84, "9": 73.50, F: 258.06 },
  "12.5":{ D: 205.95, E: 235.47, "9": 76.43, F: 265.98 },
  "13":  { D: 211.60, E: 242.10, "9": 79.36, F: 273.90 },
  "13.5":{ D: 217.25, E: 248.73, "9": 82.29, F: 281.82 },
  "14":  { D: 222.90, E: 255.36, "9": 85.22, F: 289.74 },
  "14.5":{ D: 228.55, E: 261.99, "9": 88.15, F: 297.66 },
  "15":  { D: 234.20, E: 268.62, "9": 91.08, F: 305.58 },
  "15.5":{ D: 239.85, E: 275.25, "9": 94.01, F: 313.50 },
  "16":  { D: 245.50, E: 281.88, "9": 96.94, F: 321.42 },
  "16.5":{ D: 251.15, E: 288.51, "9": 99.87, F: 329.34 },
  "17":  { D: 256.80, E: 295.14, "9": 102.80, F: 337.26 },
  "17.5":{ D: 262.45, E: 301.77, "9": 105.73, F: 345.18 },
  "18":  { D: 268.10, E: 308.40, "9": 108.66, F: 353.10 },
  "18.5":{ D: 273.75, E: 315.03, "9": 111.59, F: 361.02 },
  "19":  { D: 279.40, E: 321.66, "9": 114.52, F: 368.94 },
  "19.5":{ D: 285.05, E: 328.29, "9": 117.45, F: 376.86 },
  "20":  { D: 290.70, E: 334.92, "9": 120.38, F: 384.78 },
  "20.5":{ D: 296.35, E: 341.55, "9": 123.01, F: 392.70 },
  "21":  { D: 302.00, E: 348.18, "9": 125.64, F: 400.62 },
  "21.5":{ D: 307.65, E: 354.81, "9": 128.27, F: 408.54 },
  "22":  { D: 313.30, E: 361.44, "9": 130.90, F: 416.46 },
  "22.5":{ D: 318.95, E: 368.07, "9": 133.53, F: 424.38 },
  "23":  { D: 324.60, E: 374.70, "9": 136.16, F: 432.30 },
  "23.5":{ D: 330.25, E: 381.33, "9": 138.79, F: 440.22 },
  "24":  { D: 335.90, E: 387.96, "9": 141.42, F: 448.14 },
  "24.5":{ D: 341.55, E: 394.59, "9": 144.05, F: 456.06 },
  "25":  { D: 347.20, E: 401.22, "9": 146.68, F: 463.98 },
  "25.5":{ D: 352.85, E: 407.85, "9": 149.31, F: 471.90 },
  "26":  { D: 358.50, E: 414.48, "9": 151.94, F: 479.82 },
  "26.5":{ D: 364.15, E: 421.11, "9": 154.57, F: 487.74 },
  "27":  { D: 369.80, E: 427.74, "9": 157.20, F: 495.66 },
  "27.5":{ D: 375.45, E: 434.37, "9": 159.83, F: 503.58 },
  "28":  { D: 381.10, E: 441.00, "9": 162.46, F: 511.50 },
  "28.5":{ D: 386.75, E: 447.63, "9": 165.09, F: 519.42 },
  "29":  { D: 392.40, E: 454.26, "9": 167.72, F: 527.34 },
  "29.5":{ D: 398.05, E: 460.89, "9": 170.35, F: 535.26 },
  "30":  { D: 403.70, E: 467.52, "9": 172.98, F: 543.18 },
};

// Weight ranges > 30kg (Per KG Price)
export const COURIER_PER_KG_RATES = [
  { min: 30.1, max: 70, rates: { D: 10.17, E: 12.20, "9": 4.77, F: 15.25 } },
  { min: 70.1, max: 300, rates: { D: 10.17, E: 12.20, "9": 4.74, F: 15.25 } },
  { min: 300.1, max: 99999, rates: { D: 10.17, E: 12.20, "9": 4.74, F: 15.25 } },
];

export interface DBRateRow {
  destination: string;
  shipping_mode: string;
  rate_per_kg: number;
}

export function parseDBRates(rows: any[]) {
  const fixedRates: Record<string, Record<Region, number>> = {};
  const rangeRates: { min: number, max: number, rates: Record<Region, number> }[] = [];

  // Initialize fixed rates from constants first (as fallback)
  Object.keys(COURIER_FIXED_RATES).forEach(key => {
    fixedRates[key] = { ...COURIER_FIXED_RATES[key] };
  });

  // Initialize range rates from constants
  COURIER_PER_KG_RATES.forEach(range => {
    rangeRates.push({
      min: range.min,
      max: range.max,
      rates: { ...range.rates }
    });
  });

  if (!rows || rows.length === 0) return { fixedRates, rangeRates };

  rows.forEach(row => {
    // Only process rows that look like our region format
    if (!row.destination || !row.destination.startsWith('Region:')) return;

    const parts = row.destination.split(':');
    // Format: Region:{RegionCode}:{WeightStep}
    if (parts.length < 3) return;

    const region = parts[1] as Region;
    
    if (row.shipping_mode === 'CourierFixed') {
      const weightStep = parts[2];
      if (!fixedRates[weightStep]) fixedRates[weightStep] = {} as any;
      if (fixedRates[weightStep]) fixedRates[weightStep][region] = row.rate_per_kg;
    } else if (row.shipping_mode === 'CourierPerKg') {
      // Format: Region:{RegionCode}:{Min}-{Max}
      const rangeStr = parts[2];
      const rangeParts = rangeStr.split('-');
      if (rangeParts.length !== 2) return;

      const min = Number(rangeParts[0]);
      const max = Number(rangeParts[1]);
      
      const existingRange = rangeRates.find(r => r.min === min && r.max === max);
      if (existingRange) {
        existingRange.rates[region] = row.rate_per_kg;
      } else {
        // New range found in DB
        const newRates = { D: 0, E: 0, "9": 0, F: 0 };
        newRates[region] = row.rate_per_kg;
        rangeRates.push({ min, max, rates: newRates });
      }
    }
  });

  return { fixedRates, rangeRates };
}

export function calculateCourierCost(
  weight: number, 
  region: Region, 
  customRates?: { 
    fixedRates: Record<string, Record<Region, number>>, 
    rangeRates: typeof COURIER_PER_KG_RATES 
  }
): number {
  if (weight <= 0) return 0;

  const fixedRates = customRates?.fixedRates || COURIER_FIXED_RATES;
  const rangeRates = customRates?.rangeRates || COURIER_PER_KG_RATES;

  if (weight <= 30) {
    // Round up to nearest 0.5
    const steppedWeight = Math.ceil(weight * 2) / 2;
    const key = steppedWeight.toString();
    return fixedRates[key]?.[region] || 0;
  } else {
    const range = rangeRates.find(r => weight >= r.min && weight <= r.max);
    if (range) {
      return weight * range.rates[region];
    }
    // Fallback to highest range
    if (rangeRates.length > 0) {
        return weight * rangeRates[rangeRates.length - 1].rates[region];
    }
    return 0;
  }
}
