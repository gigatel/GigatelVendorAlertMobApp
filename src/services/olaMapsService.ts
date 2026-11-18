// src/services/olaMapsService.ts
import {OLA_MAP_API} from '@env';

const OLA_API_KEY = OLA_MAP_API;
const OLA_BASE_URL = 'https://api.olamaps.io/places/v1';

export interface OlaAddress {
  formattedAddress: string;
}

export const olaReverseGeocode = async (
  lat: number,
  lng: number,
): Promise<OlaAddress | null> => {
  try {
    // ✅ validation
    if (!OLA_API_KEY) {
      console.warn('❌ OLA_MAP_API key missing in env');
      return null;
    }

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.warn('❌ Invalid lat/lng:', lat, lng);
      return null;
    }

    // ✅ Ola official format
    const url =
      `${OLA_BASE_URL}/reverse-geocode` +
      `?latlng=${lat},${lng}&api_key=${OLA_API_KEY}`;

    console.log('📍 Ola Reverse Geocode:', url);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn('❌ Ola API error:', res.status);
      return null;
    }

    const json = await res.json();
    console.log('✅ Ola response:', JSON.stringify(json, null, 2));

    const results = json?.results || json?.geocodingResults;
    const first = results?.[0];

    if (!first) {
      console.warn('⚠️ No address found from Ola');
      return null;
    }

    return {
      formattedAddress:
        first.formatted_address ||
        first.formattedAddress ||
        first.display_name ||
        first.displayName ||
        first.address ||
        '',
    };
  } catch (e) {
    console.log('❌ Ola reverse geocode error', e);
    return null;
  }
};
