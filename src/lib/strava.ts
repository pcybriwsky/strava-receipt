// Strava API utilities

export const STRAVA_API_BASE = "https://www.strava.com/api/v3";
export const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

// Activity types that support GPS routes
export const GPS_ACTIVITY_TYPES = new Set([
  "Run", "Ride", "Walk", "Hike", "Swim",
  "VirtualRide", "VirtualRun", "TrailRun",
  "EBikeRide", "GravelRide", "MountainBikeRide",
  "Handcycle", "InlineSkate", "Kayaking", "Kitesurf",
  "NordicSki", "AlpineSki", "BackcountrySki",
  "Canoeing", "Golf", "IceSkate", "Rowing", "Sail",
  "Skateboard", "Snowboard", "Snowshoe",
  "StandUpPaddling", "Surfing", "Velomobile",
  "Windsurf", "Wheelchair"
]);

export function activitySupportsGPS(activityType: string): boolean {
  return GPS_ACTIVITY_TYPES.has(activityType);
}

export function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function formatDistance(meters: number, units: 'miles' | 'km'): number {
  return units === 'miles' ? metersToMiles(meters) : metersToKm(meters);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function calculatePace(distanceMeters: number, seconds: number, units: 'miles' | 'km' = 'miles'): string {
  if (!distanceMeters || !seconds || distanceMeters === 0) return 'N/A';
  const distance = units === 'miles' ? distanceMeters / 1609.34 : distanceMeters / 1000;
  const paceSeconds = seconds / distance;
  const paceMin = Math.floor(paceSeconds / 60);
  const paceSec = Math.round(paceSeconds % 60);
  return `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function getActivityTypeClass(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('run')) return 'run';
  if (t.includes('ride') || t.includes('cycling')) return 'ride';
  if (t.includes('swim')) return 'swim';
  if (t.includes('walk')) return 'walk';
  if (t.includes('hike')) return 'hike';
  if (t.includes('weight')) return 'weight';
  if (t.includes('workout') || t.includes('yoga') || t.includes('crossfit')) return 'workout';
  return '';
}

// Reverse geocoding using OpenStreetMap Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; state?: string; country?: string } | null> {
  try {
    // Use Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Strava-Receipt-App/1.0' // Required by Nominatim
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Reverse geocoding failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const address = data.address || {};
    
    // Extract location components (field names vary by country)
    const city = address.city || address.town || address.village || address.municipality || address.county;
    const state = address.state || address.region || address.province;
    const country = address.country;
    
    return {
      city: city || undefined,
      state: state || undefined,
      country: country || undefined
    };
  } catch (error) {
    console.warn('Reverse geocoding error:', error);
    return null;
  }
}

// Types
export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  average_heartrate?: number;
  calories?: number;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  start_latlng?: [number, number] | null;
  device_name?: string | null;
  gear_id?: string | null;
  gear?: {
    id: string;
    name: string;
    nickname?: string | null;
  } | null;
  description?: string | null;
  achievements?: Array<{
    type_id: number;
    type: string;
    rank?: number;
  }> | null;
  pr_count?: number;
  achievement_count?: number;
}

export interface StravaPhoto {
  unique_id: string;
  urls: {
    [key: string]: string;
  };
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

