/** WGS84 と UTM の相互変換（Krüger 級数、4 次。ゾーン内で mm 以下の精度）。 */

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E0 = 500000;
const N0_SOUTH = 10000000;

const N = F / (2 - F);
const N2 = N * N;
const N3 = N2 * N;
const N4 = N3 * N;
const RECT_RADIUS = (A / (1 + N)) * (1 + N2 / 4 + N4 / 64);

const ALPHA = [
  N / 2 - (2 * N2) / 3 + (5 * N3) / 16 + (41 * N4) / 180,
  (13 * N2) / 48 - (3 * N3) / 5 + (557 * N4) / 1440,
  (61 * N3) / 240 - (103 * N4) / 140,
  (49561 * N4) / 161280,
];
const BETA = [
  N / 2 - (2 * N2) / 3 + (37 * N3) / 96 - N4 / 360,
  N2 / 48 + N3 / 15 - (437 * N4) / 1440,
  (17 * N3) / 480 - (37 * N4) / 840,
  (4397 * N4) / 161280,
];
const DELTA = [
  2 * N - (2 * N2) / 3 - 2 * N3 + (116 * N4) / 45,
  (7 * N2) / 3 - (8 * N3) / 5 - (227 * N4) / 45,
  (56 * N3) / 15 - (136 * N4) / 35,
  (4279 * N4) / 630,
];

const DEG = Math.PI / 180;

export interface UtmCoord {
  zone: number;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
}

export function utmZoneFromLon(lon: number): number {
  const normalized = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Math.min(60, Math.floor((normalized + 180) / 6) + 1);
}

function centralMeridianRad(zone: number): number {
  return ((zone - 1) * 6 - 180 + 3) * DEG;
}

/** 緯度経度 → UTM。`zone` を渡すとその帯に固定して計算する（原点と同じ帯で連続的に扱うため）。 */
export function latLonToUtm(lat: number, lon: number, zone?: number, hemisphere?: 'N' | 'S'): UtmCoord {
  const z = zone ?? utmZoneFromLon(lon);
  const hemi = hemisphere ?? (lat >= 0 ? 'N' : 'S');
  const phi = lat * DEG;
  const lambda = lon * DEG - centralMeridianRad(z);

  const c = (2 * Math.sqrt(N)) / (1 + N);
  const sinPhi = Math.sin(phi);
  const t = Math.sinh(Math.atanh(sinPhi) - c * Math.atanh(c * sinPhi));
  const xiP = Math.atan2(t, Math.cos(lambda));
  const etaP = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));

  let xi = xiP;
  let eta = etaP;
  for (let j = 1; j <= 4; j++) {
    xi += ALPHA[j - 1] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
    eta += ALPHA[j - 1] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
  }

  const northOffset = hemi === 'S' ? N0_SOUTH : 0;
  return {
    zone: z,
    hemisphere: hemi,
    easting: E0 + K0 * RECT_RADIUS * eta,
    northing: northOffset + K0 * RECT_RADIUS * xi,
  };
}

export function utmToLatLon(utm: UtmCoord): { lat: number; lon: number } {
  const northOffset = utm.hemisphere === 'S' ? N0_SOUTH : 0;
  const xi = (utm.northing - northOffset) / (K0 * RECT_RADIUS);
  const eta = (utm.easting - E0) / (K0 * RECT_RADIUS);

  let xiP = xi;
  let etaP = eta;
  for (let j = 1; j <= 4; j++) {
    xiP -= BETA[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= BETA[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }

  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (let j = 1; j <= 4; j++) {
    phi += DELTA[j - 1] * Math.sin(2 * j * chi);
  }
  const lambda = centralMeridianRad(utm.zone) + Math.atan2(Math.sinh(etaP), Math.cos(xiP));

  return { lat: phi / DEG, lon: lambda / DEG };
}
