import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  LayoutChangeEvent,
  Alert,
  Linking,
  ActivityIndicator,
  ToastAndroid,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import React, {
  FC,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import * as Animatable from 'react-native-animatable';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';
import {AppDispatch} from '@reducers';
import {
  FontSize,
  Border,
  Gap,
  BoxShadow,
  Padding,
  LineHeight,
  LetterSpacing,
  Width,
  Height,
} from '../../res/globalStyle';
import {
  getSLDEReportAPI,
  getPitListWithChamberStatus,
  getOpenShotDetailsByIdAPI,
  getProjectDuctColorDDAPI,
  getItemMasterTypeAPi,
  getNearestPitLatLng,
  insertUpdateChamberInstallationAPI,
} from '../../store/slices/dss.slice';
import {useDispatch} from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import DssCustomPicker from '../../../src/components/molecules/DsscustomPicker';
import {CaptureImageWatermark} from '@molecules';
import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';
import {Location, Common} from '@utils';

// ── Constants ─────────────────────────────────────────────────────────────────
const DASH_COL_WIDTH = 35;
const CARD_GAP = 8;
const BETWEEN_ROW_H = 44;
const BETWEEN_ROW_H_ACTIVE = 100;
const PIN_SIZE = 20;
const DASH_H = 5;
const DASH_GAP = 4;
const DASH_W = 1.5;
const TOAST_INTERVAL_MS = 15000;
const YOU_ARE_HERE_THRESHOLD_M = 50; //previous 30
const CLICKABLE_RANGE_M = 40; //previous 20

// ── Extra spacing for default coupler between-rows ────────────────────────────
const BETWEEN_ROW_H_DEFAULT_COUPLER = 80;

const PIT_TYPES_REQUIRING_MODAL: string[] = ['default coupler'];

const COLOR_HEX_MAP: Record<string, string> = {
  blue: '#1976D2',
  green: '#3EC21E',
  orange: '#F57C00',
  red: '#D32F2F',
  yellow: '#F9A825',
  purple: '#7B1FA2',
  pink: '#E91E63',
  brown: '#5D4037',
  grey: '#757575',
  gray: '#757575',
  black: '#212121',
  white: '#BDBDBD',
  cyan: '#0097A7',
  indigo: '#303F9F',
  teal: '#00796B',
  lime: '#689F38',
  amber: '#FFB300',
};
const getColorHex = (colorName: string): string => {
  const firstWord = (colorName ?? '').split(/[-\s]/)[0];
  return COLOR_HEX_MAP[firstWord?.toLowerCase?.() ?? ''] ?? '#888';
};

// ── GPS helpers ───────────────────────────────────────────────────────────────
type UserCoords = {latitude: number; longitude: number} | null;

type DuctItem = {
  ductNo: number;
};

// ── Yes/No picker options ─────────────────────────────────────────────────────
const DUCT_STAND_OPTIONS = [
  {label: 'Yes', value: 'Yes'},
  {label: 'No', value: 'No'},
];
const PCC_DONE_OPTIONS = [
  {label: 'Yes', value: 'Yes'},
  {label: 'No', value: 'No'},
];

// ── ItemMasterType ────────────────────────────────────────────────────────────
type ItemMasterType = {
  id: number;
  itemName: string;
};

// ── VendorItem ────────────────────────────────────────────────────────────────
type VendorItem = {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
};

const parseVendors = (
  vendorID: string | undefined,
  vendorCode: string | undefined,
  vendorName: string | undefined,
): VendorItem[] => {
  const ids = (vendorID ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const codes = (vendorCode ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const names = (vendorName ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const count = Math.max(ids.length, codes.length, names.length);
  if (count === 0) return [];
  return Array.from({length: count}, (_, i) => ({
    vendorId: ids[i] ?? '',
    vendorCode: codes[i] ?? '',
    vendorName: names[i] ?? '',
  }));
};

// ── VendorPicker ──────────────────────────────────────────────────────────────
type VendorPickerProps = {
  data: VendorItem[];
  value: VendorItem | null;
  placeholder: string;
  onSelect: (item: VendorItem) => void;
  hasError: boolean;
};

const VendorPicker: FC<VendorPickerProps> = ({
  data,
  value,
  placeholder,
  onSelect,
  hasError,
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[vendorStyles.inputBox, hasError && vendorStyles.inputBoxError]}
        onPress={() => setVisible(true)}>
        <Text
          style={[vendorStyles.inputText, !value && vendorStyles.placeholder]}
          numberOfLines={1}>
          {value ? value.vendorName : placeholder}
        </Text>
        <Text style={vendorStyles.arrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={vendorStyles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={vendorStyles.dropdown}>
            {data.map((item, index) => (
              <TouchableOpacity
                key={`${item.vendorId}-${index}`}
                style={[
                  vendorStyles.item,
                  index < data.length - 1 && vendorStyles.itemBorder,
                  value?.vendorId === item.vendorId &&
                    vendorStyles.itemSelected,
                ]}
                onPress={() => {
                  onSelect(item);
                  setVisible(false);
                }}>
                <Text style={vendorStyles.itemName}>{item.vendorName}</Text>
                {!!item.vendorCode && (
                  <Text style={vendorStyles.itemCode}>{item.vendorCode}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const vendorStyles = StyleSheet.create({
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6EEF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: COLORS.colorWhite,
    justifyContent: 'space-between',
  },
  inputBoxError: {borderColor: COLORS.ERROR ?? '#f44', borderWidth: 1.5},
  inputText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  placeholder: {color: '#aaa'},
  arrow: {fontSize: 13, color: '#888', marginLeft: 6},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  item: {paddingHorizontal: 16, paddingVertical: 14},
  itemBorder: {borderBottomWidth: 1, borderBottomColor: '#f0f0f0'},
  itemSelected: {backgroundColor: '#EEF2FF'},
  itemName: {fontSize: 14, fontFamily: FONTS.MEDIUM, color: '#1a1a1a'},
  itemCode: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#5C6BC0',
    marginTop: 2,
  },
});
// ── GPS fresh position ────────────────────────────────────────────────────────
const getFreshPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    const RNGeolocation =
      require('@react-native-community/geolocation').default;
    RNGeolocation.getCurrentPosition(
      (pos: GeolocationPosition) => resolve(pos),
      (err: GeolocationPositionError) => reject(err),
      {enableHighAccuracy: true, timeout: 20000, maximumAge: 0},
    );
  });
// ── Small reusable InfoRow ────────────────────────────────────────────────────
const InfoRow: FC<{label: string; value: string; loading?: boolean}> = ({
  label,
  value,
  loading,
}) => (
  <View style={infoRowSt.row}>
    <Text style={infoRowSt.label}>{label}</Text>
    {loading ? (
      <ActivityIndicator
        size="small"
        color={COLORS.PRIMARY}
        style={{marginLeft: 4}}
      />
    ) : (
      <Text style={infoRowSt.val} numberOfLines={3}>
        {value || '—'}
      </Text>
    )}
  </View>
);
const infoRowSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: 'stretch',
  },
  label: {
    width: 96,
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    letterSpacing: 0.2,
    paddingTop: 2,
  },
  val: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: '#444',
    lineHeight: 19,
  },
});
const Divider = () => (
  <View style={{height: 1, backgroundColor: '#F0F4F8', marginVertical: 2}} />
);

// ── Helper: check if a pit is considered "blown/done" ────────────────────────
const isPitBlown = (blowingStatus: string | undefined | null): boolean => {
  const s = (blowingStatus ?? '').trim().toLowerCase();
  return s === 'installed' || s === 'done' || s === 'completed';
};

// ── Helper: check if pit type is default coupler ──────────────────────────────
const isDefaultCouplerPit = (pit: PitItem): boolean => {
  const pitTypeValue = String(pit?.pitType || pit?.itemName || '')
    .trim()
    .toLowerCase();
  return (
    pitTypeValue.includes('default coupler') ||
    pitTypeValue.includes('defaultcoupler')
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION LOCK TYPE
// ─────────────────────────────────────────────────────────────────────────────
type DirectionLock = 'none' | 'forward' | 'backward';

// ─────────────────────────────────────────────────────────────────────────────
// UPDATED: getClickablePitIds
//
// Rules:
// 1. ALL pits uninstalled (fresh start) → ALL clickable
// 2. Any pits installed + directionLock === 'none':
//    → Show ALL isOpen===true pits (both forward and backward neighbors)
//    → This handles the "middle start" case where both 2 and 4 are open
// 3. directionLock === 'forward':
//    → Only the next forward isOpen pit is clickable
//    → Backward side locked until forward chain is complete
//    → Forward chain complete = no more isOpen in forward direction
//      → then unlock backward (directionLock resets to 'none' from parent)
// 4. directionLock === 'backward':
//    → Only the next backward isOpen pit is clickable
//    → Forward side locked
// ─────────────────────────────────────────────────────────────────────────────
const getClickablePitIds = (
  list: PitItem[],
  directionLock: DirectionLock,
): Set<number> => {
  if (!list || list.length === 0) return new Set();

  // ── Case 1: Fresh start — all clickable ──────────────────────────────────
  const installedIndexes = list
    .map((p, i) => (isPitBlown(p.blowingStatus) ? i : -1))
    .filter(i => i !== -1);

  // if (installedIndexes.length === 0) {
  //   return new Set(list.map(p => p.pitLocationId));
  // }
  if (installedIndexes.length === 0) {
    return new Set(
      list
        .filter(p => {
          const pitType = String(p?.pitType || p?.itemName || '')
            .trim()
            .toLowerCase();

          return !pitType.includes('coupler');
        })
        .map(p => p.pitLocationId),
    );
  }

  // Collect all isOpen indexes
  const openIndexes: number[] = [];
  list.forEach((p, i) => {
    if (
      p.isShotOpen === true ||
      p.isOpenForShot === true ||
      p.isOpen === true
    ) {
      openIndexes.push(i);
    }
  });

  if (openIndexes.length === 0) {
    return new Set();
  }

  const lastInstalledIndex = installedIndexes[installedIndexes.length - 1];
  const clickable = new Set<number>();

  // ── Case 2: No direction locked yet — show ALL isOpen pits ───────────────
  // This is the middle-start case: user installed pit 3, both pit 2 and 4
  // have isOpen===true, so both should be shown as clickable.
  if (directionLock === 'none') {
    openIndexes.forEach(i => {
      clickable.add(list[i].pitLocationId);
    });
    return clickable;
  }

  // ── Case 3: Direction is FORWARD — only next forward open pit ────────────
  if (directionLock === 'forward') {
    for (let i = lastInstalledIndex + 1; i < list.length; i++) {
      const pit = list[i];
      const isOpen =
        pit.isShotOpen === true ||
        pit.isOpenForShot === true ||
        pit.isOpen === true;

      if (isOpen) {
        clickable.add(pit.pitLocationId);
        // Only first open forward pit — stop here
        break;
      }

      // If there's a pending (not installed) pit in between, stop
      if (!isPitBlown(pit.blowingStatus)) {
        break;
      }
    }
    return clickable;
  }

  // ── Case 4: Direction is BACKWARD — only next backward open pit ──────────
  if (directionLock === 'backward') {
    for (let i = lastInstalledIndex - 1; i >= 0; i--) {
      const pit = list[i];
      const isOpen =
        pit.isShotOpen === true ||
        pit.isOpenForShot === true ||
        pit.isOpen === true;

      if (isOpen) {
        clickable.add(pit.pitLocationId);
        // Only first open backward pit — stop here
        break;
      }

      if (!isPitBlown(pit.blowingStatus)) {
        break;
      }
    }
    return clickable;
  }

  return clickable;
};

// ── Helper: detect what direction a clicked pit index is relative to last installed ──
const detectClickDirection = (
  clickedIndex: number,
  list: PitItem[],
): DirectionLock => {
  const installedIndexes = list
    .map((p, i) => (isPitBlown(p.blowingStatus) ? i : -1))
    .filter(i => i !== -1);

  if (installedIndexes.length === 0) return 'none';

  const lastInstalledIndex = installedIndexes[installedIndexes.length - 1];

  if (clickedIndex > lastInstalledIndex) return 'forward';
  if (clickedIndex < lastInstalledIndex) return 'backward';
  return 'none';
};

// ── Helper: check if the current direction chain is complete ─────────────────
// "Complete" means no more isOpen pits in the locked direction
const isDirectionChainComplete = (
  list: PitItem[],
  direction: DirectionLock,
): boolean => {
  if (direction === 'none') return true;

  const installedIndexes = list
    .map((p, i) => (isPitBlown(p.blowingStatus) ? i : -1))
    .filter(i => i !== -1);

  if (installedIndexes.length === 0) return true;

  const lastInstalledIndex = installedIndexes[installedIndexes.length - 1];

  if (direction === 'forward') {
    // Check if there's any isOpen pit forward of lastInstalled
    for (let i = lastInstalledIndex + 1; i < list.length; i++) {
      const p = list[i];
      if (
        p.isShotOpen === true ||
        p.isOpenForShot === true ||
        p.isOpen === true
      ) {
        return false; // Still has forward open pits
      }
    }
    return true; // No more forward open pits
  }

  if (direction === 'backward') {
    // Check if there's any isOpen pit backward of lastInstalled
    for (let i = lastInstalledIndex - 1; i >= 0; i--) {
      const p = list[i];
      if (
        p.isShotOpen === true ||
        p.isOpenForShot === true ||
        p.isOpen === true
      ) {
        return false; // Still has backward open pits
      }
    }
    return true; // No more backward open pits
  }

  return true;
};

const smoothCoords = (
  prev: UserCoords,
  next: {latitude: number; longitude: number},
): {latitude: number; longitude: number} => {
  if (!prev) return {latitude: next.latitude, longitude: next.longitude};
  const alpha = 0.35;
  return {
    latitude: prev.latitude + alpha * (next.latitude - prev.latitude),
    longitude: prev.longitude + alpha * (next.longitude - prev.longitude),
  };
};

const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DEG_TO_M = 111_320;
const PERP_TOL_M = 25;
const T_LOW = -0.05;
const T_HIGH = 1.05;

const segmentCheck = (
  userLat: number,
  userLng: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): {onSegment: boolean; perp: number; t: number} => {
  const abLat = latB - latA;
  const abLng = lngB - lngA;
  const apLat = userLat - latA;
  const apLng = userLng - lngA;
  const abDot = abLat * abLat + abLng * abLng;
  if (abDot < 1e-18) return {onSegment: false, perp: Infinity, t: -1};
  const t = (apLat * abLat + apLng * abLng) / abDot;
  const closestLat = latA + t * abLat;
  const closestLng = lngA + t * abLng;
  const dLatM = (userLat - closestLat) * DEG_TO_M;
  const avgLat = (userLat + closestLat) / 2;
  const dLngM =
    (userLng - closestLng) * DEG_TO_M * Math.cos((avgLat * Math.PI) / 180);
  const perp = Math.sqrt(dLatM * dLatM + dLngM * dLngM);
  const onSegment = t >= T_LOW && t <= T_HIGH && perp <= PERP_TOL_M;
  return {onSegment, perp, t};
};

const findActiveBetweenIndex = (
  userLat: number,
  userLng: number,
  pitList: any[],
): number => {
  if (!pitList || pitList.length < 2) return -1;
  let bestIndex = -1;
  let bestScore = Infinity;
  for (let i = 0; i < pitList.length - 1; i++) {
    const latA = parseFloat(pitList[i]?.lat ?? '0');
    const lngA = parseFloat(pitList[i]?.lon ?? '0');
    const latB = parseFloat(pitList[i + 1]?.lat ?? '0');
    const lngB = parseFloat(pitList[i + 1]?.lon ?? '0');
    if (
      isNaN(latA) ||
      isNaN(lngA) ||
      isNaN(latB) ||
      isNaN(lngB) ||
      (latA === 0 && lngA === 0) ||
      (latB === 0 && lngB === 0)
    )
      continue;
    const {perp, t} = segmentCheck(userLat, userLng, latA, lngA, latB, lngB);
    const tClamped = Math.max(0, Math.min(1, t));
    const centredness = Math.abs(tClamped - 0.5);
    const forwardBias = t >= 0 && t < 0.3 ? -0.05 : 0;
    const perpNorm = perp / 40;
    const score = centredness + forwardBias + perpNorm * 0.3;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
};

const showToast = (msg: string) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
};
const openMapDirections = (location: string | undefined, label: string) => {
  if (!location) {
    Alert.alert('No Location', `No valid coordinates available for ${label}.`);
    return;
  }

  const [lat, lng] = location.split(',');

  const pLat = parseFloat(lat);
  const pLng = parseFloat(lng);

  if (isNaN(pLat) || isNaN(pLng) || (pLat === 0 && pLng === 0)) {
    Alert.alert('No Location', `No valid coordinates available for ${label}.`);
    return;
  }

  const mapsUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${pLat},${pLng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLng}`;

  Linking.openURL(mapsUrl).catch(() => {
    Alert.alert('Error', 'Unable to open Maps.');
  });
};

const getCurrentPosition = (): Promise<{latitude: number; longitude: number}> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {
        Geolocation.getCurrentPosition(
          pos =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          err => reject(err),
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
        );
      },
      {enableHighAccuracy: false, timeout: 3000, maximumAge: 0},
    );
  });

// ── Types ─────────────────────────────────────────────────────────────────────
type PitItem = {
  pitLocationId: number;
  pitNo: string;
  pitLandmark: string;
  pitGPSLocation: string;
  lat: string;
  projectShotDetailsId?: number;
  lon: string;
  pic1Url: string;
  pic2Url: string;
  chamberStatus: string;
  isShotOpen?: boolean;
  isOpenForShot?: boolean;
  isOpen?: boolean;
  fromTo?: string | null;
  itemName?: string;
  blowingStatus?: string;
  pitAddress?: string;
  pitId?: number;
  loop?: number;
  distance: number;
  chamberId?: number;
  vendorStoreId?: number;
  fiberTypeId?: number;
  fiberType?: string;
  shotMapDuctColorId?: number;
  pitType?: string;
  PitItemId?: number;
};

type GalleryItem = {
  pitId: string;
  pic1Url: string | null;
  pic2Url: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const displayPitNo = (pitNo: string | number): string => {
  const s = String(pitNo ?? '').trim();
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
};
const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};
const safeCoord = (raw: string | number | undefined | null): number | null => {
  const n = parseFloat(String(raw ?? ''));
  return isFinite(n) && !isNaN(n) ? n : null;
};
const hasValidCoords = (lat: number | null, lng: number | null): boolean =>
  lat !== null && lng !== null;
const safeDistance = (
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null,
): number | null => {
  if (!hasValidCoords(lat1, lng1) || !hasValidCoords(lat2, lng2)) return null;
  return haversineDistance(lat1!, lng1!, lat2!, lng2!);
};

// ── Dashed line components ────────────────────────────────────────────────────
const VerticalDashedLine: FC<{
  height: number;
  color?: string;
  opacity?: number;
}> = ({height, color = COLORS.colorDimgray ?? '#888', opacity = 0.5}) => {
  if (Platform.OS === 'android') {
    return (
      <View
        style={{
          width: DASH_W,
          height,
          borderLeftWidth: DASH_W,
          borderStyle: 'dashed',
          borderColor: color,
          opacity,
        }}
      />
    );
  }
  const count = Math.floor(height / (DASH_H + DASH_GAP)) + 1;
  return (
    <View style={{width: DASH_W, height, overflow: 'hidden', opacity}}>
      {Array.from({length: count}).map((_, i) => (
        <View
          key={i}
          style={{
            width: DASH_W,
            height: DASH_H,
            backgroundColor: color,
            marginBottom: DASH_GAP,
          }}
        />
      ))}
    </View>
  );
};

const VerticalDashedLineAutoHeight: FC<{
  left: number;
  color?: string;
  opacity?: number;
  onHeightMeasured?: (h: number) => void;
}> = ({left, color, opacity, onHeightMeasured}) => {
  const [h, setH] = useState(0);
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={e => {
        const measured = e.nativeEvent.layout.height;
        setH(measured);
        onHeightMeasured?.(measured);
      }}>
      <View style={{position: 'absolute', top: 0, left}}>
        {h > 0 && (
          <VerticalDashedLine height={h} color={color} opacity={opacity} />
        )}
      </View>
    </View>
  );
};

const ShortDashedConnector: FC<{color?: string}> = ({
  color = COLORS.colorDarkslategray ?? '#555',
}) => {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.dashedWrap}>
        <View
          style={{
            width: 0,
            height: 8,
            borderLeftWidth: DASH_W,
            borderStyle: 'dashed',
            borderColor: color,
            opacity: 0.45,
          }}
        />
      </View>
    );
  }
  return (
    <View style={styles.dashedWrap}>
      <View style={{width: DASH_W, opacity: 0.45}}>
        <View
          style={{
            width: DASH_W,
            height: 3,
            backgroundColor: color,
            marginBottom: 2,
          }}
        />
        <View style={{width: DASH_W, height: 3, backgroundColor: color}} />
      </View>
    </View>
  );
};

// ── Active Pit Badge ──────────────────────────────────────────────────────────
const ActivePitBadge: FC<{
  activePitLocationId: number | null;
  isLoading: boolean;
}> = ({activePitLocationId, isLoading}) => {
  if (isLoading) {
    return (
      <Animatable.View
        animation="pulse"
        iterationCount="infinite"
        duration={1200}
        style={styles.activePitBadgeSkeleton}>
        <ActivityIndicator size={12} color="#1976D2" style={{marginRight: 6}} />
        <Text style={styles.activePitBadgeSkeletonText}>
          Detecting active pit…
        </Text>
      </Animatable.View>
    );
  }
  if (activePitLocationId === null) return null;
  return (
    <View style={styles.activePitBadge}>
      <View style={styles.activePitBadgeDot} />
      <Text style={styles.activePitBadgeLabel}>Active PIT: </Text>
      <Text style={styles.activePitBadgeValue}>#{activePitLocationId}</Text>
    </View>
  );
};

const pitListCache: Record<string, PitItem[]> = {};

// ─────────────────────────────────────────────────────────────────────────────
// DefaultCouplerInstallationForm — WITH COLLAPSIBLE CARD
// ─────────────────────────────────────────────────────────────────────────────
type DefaultCouplerFormProps = {
  pit: PitItem;
  pitIndex: number;
  projectId: string | number;
  projectCode: string;
  projectName: string;
  vendorID: string | number | undefined;
  vendorCode: string | undefined;
  vendorName: string | undefined;
  selectedDuctNo: number;
  onClose: () => void;
  onSuccess: () => void;
  dispatch: any;
};

const DefaultCouplerInstallationForm: FC<DefaultCouplerFormProps> = ({
  pit,
  pitIndex,
  projectId,
  projectCode,
  projectName,
  vendorID,
  vendorCode,
  vendorName,
  selectedDuctNo,
  onClose,
  onSuccess,
  dispatch,
}) => {
  // ── Vendors ───────────────────────────────────────────────────────────────
  const vendorList: VendorItem[] = useMemo(
    () =>
      parseVendors(
        String(vendorID ?? ''),
        String(vendorCode ?? ''),
        String(vendorName ?? ''),
      ),
    [vendorID, vendorCode, vendorName],
  );
  const isMultiVendor = vendorList.length > 1;
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(() =>
    vendorList.length === 1 ? vendorList[0] : null,
  );

  // ── Collapsible card state ────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const [gpsLat, setGpsLat] = useState<string>('');
  const [gpsLong, setGpsLong] = useState<string>('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isInitialGpsFetch, setIsInitialGpsFetch] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCountingDown = countdown !== null;

  // ── Item Types ────────────────────────────────────────────────────────────
  const [itemMasterTypes, setItemMasterTypes] = useState<ItemMasterType[]>([]);
  const [isLoadingItemTypes, setIsLoadingItemTypes] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<{
    id: number;
    itemName: string;
  } | null>(null);
  const [nearestPitId, setNearestPitId] = useState<number>(0);

  // ── Images ────────────────────────────────────────────────────────────────
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);

  // ── Form fields ───────────────────────────────────────────────────────────
  const [remarks, setRemarks] = useState('');
  const [ductStand, setDuctStand] = useState<{
    label: string;
    value: string;
  } | null>({label: 'No', value: 'No'});
  const [pccDone, setPccDone] = useState<{label: string; value: string} | null>(
    {label: 'Yes', value: 'Yes'},
  );
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select coupler item type
  useEffect(() => {
    if (itemMasterTypes.length > 0 && !selectedItemType) {
      const couplerItem = itemMasterTypes.find(
        item => item.itemName?.trim().toLowerCase() === 'coupler',
      );
      if (couplerItem)
        setSelectedItemType({
          id: couplerItem.id,
          itemName: couplerItem.itemName,
        });
    }
  }, [itemMasterTypes, selectedItemType]);

  const fetchItemMasterTypes = async () => {
    try {
      setIsLoadingItemTypes(true);
      const result = await dispatch(getItemMasterTypeAPi(undefined));
      if (getItemMasterTypeAPi.fulfilled.match(result)) {
        const data = result.payload as ItemMasterType[];
        if (Array.isArray(data) && data.length > 0) setItemMasterTypes(data);
        else Common.showToast('No item types found.');
      } else Common.showToast('Failed to load item types.');
    } catch {
      Common.showToast('Error fetching item types.');
    } finally {
      setIsLoadingItemTypes(false);
    }
  };

  useEffect(() => {
    fetchItemMasterTypes();
    setTimeout(() => {
      fetchGPS(true);
    }, 500);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const itemTypePickerData = itemMasterTypes.map(item => ({
    label: item.itemName,
    value: item.id,
    id: item.id,
    itemName: item.itemName,
  }));

  // ── GPS fetch ─────────────────────────────────────────────────────────────
  const fetchGPS = async (isAutoFetch = false) => {
    try {
      setIsLoadingGps(true);
      setLocationError('');

      const perm = await Location.checkPermission();
      if (perm !== 'granted') {
        if (!isAutoFetch) {
          Alert.alert(
            'Permission Required',
            'Location permission is required.',
          );
        }
        return;
      }

      let freshLat: number;
      let freshLong: number;
      let position: any;

      try {
        if (isAutoFetch) {
          position = await new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(
              pos => resolve(pos),
              err => reject(err),
              {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000,
              },
            );
          });
        } else {
          position = await getFreshPosition();
        }

        freshLat = position.coords.latitude;
        freshLong = position.coords.longitude;
      } catch (posErr: any) {
        if (isAutoFetch) {
          return;
        }

        const msg =
          posErr?.code === 3
            ? 'GPS timed out. Move to open area and try again.'
            : posErr?.code === 2
            ? 'GPS unavailable. Please enable location services.'
            : 'Could not get GPS. Please try again.';

        setLocationError(msg);
        Alert.alert('GPS Error', msg);
        return;
      }

      let resolvedAddress = '';

      try {
        const data = await Location.getAddressFromLatLong(
          false,
          freshLat,
          freshLong,
        );

        if (data?.address) {
          resolvedAddress = data.address;
        }
      } catch (err) {
        console.log('Address fetch failed', err);
      }

      setGpsLat(String(freshLat));
      setGpsLong(String(freshLong));
      setAddress(resolvedAddress || '');

      if (!resolvedAddress) {
        setLocationError('Address could not be resolved.');
      } else {
        setLocationError('');
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Location error');
    } finally {
      setIsLoadingGps(false);
      if (isAutoFetch) {
        setIsInitialGpsFetch(false);
      }
    }
  };

  const handleGetGPS = async () => {
    const perm = await Location.checkPermission();
    if (perm !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is required.');
      return;
    }
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(10);
    let remaining = 10;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        fetchGPS(false);
      }
    }, 1000);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs: any = {};
    if (!gpsLat || !gpsLong) errs.gps = true;
    if (!address?.trim()) errs.address = true;
    if (!landmark?.trim()) errs.landmark = true;
    if (!remarks?.trim()) errs.remarks = true;
    if (!pic1) errs.image1 = true;
    if (!pic2) errs.image2 = true;
    if (!ductStand) errs.ductStand = true;
    if (!selectedItemType) errs.itemType = true;
    if (!selectedVendor) errs.vendor = true;
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const apiPayload = {
        id: 0,
        projectId: Number(projectId) ?? 0,
        shotId: Number(pit?.projectShotDetailsId) ?? 0,
        vendorId: Number(selectedVendor?.vendorId) ?? 0,
        vendorStoreId: pit?.vendorStoreId ?? 0,
        insidePic: pic1,
        outsidePic: pic2,
        itemId: Number(selectedItemType?.id) ?? 0,
        itemTypeId: Number(selectedItemType?.id) ?? 0,
        gpsLocation: address ?? '',
        landmark: landmark ?? '',
        lat: gpsLat ?? '',
        lon: gpsLong ?? '',
        ductStand: ductStand?.value ?? 'No',
        pccDone: 'No',
        pitLocationId: Number(pit?.pitId) ?? 0,
        remark: remarks ?? '',
        ductNo: selectedDuctNo,
      };
      console.log('📤 Default Coupler Modal Payload =>', apiPayload);
      const result = await dispatch(
        insertUpdateChamberInstallationAPI(apiPayload),
      );
      if (insertUpdateChamberInstallationAPI.fulfilled.match(result)) {
        Common.showToast('Chamber installation saved successfully!');
        onSuccess();
      } else {
        Alert.alert(
          'Error',
          typeof result.payload === 'string'
            ? result.payload
            : 'Failed to save. Please try again.',
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const pitDisplayNo = displayPitNo(pit?.pitNo ?? '');
  const displayVendorName =
    selectedVendor?.vendorName || vendorList[0]?.vendorName || vendorName || '';
  const gpsReady = !!(gpsLat && gpsLong);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{flex: 1}}>
      {/* ── Modal Header ── */}
      <View style={fS.header}>
        <View style={fS.headerLeft}>
          <View style={fS.pitTypeBadge}>
            <Text style={fS.pitTypeBadgeText}>Default Coupler</Text>
          </View>
          <Text style={fS.headerPitNo}>PIT - {pitDisplayNo}</Text>
        </View>
        <TouchableOpacity
          hitSlop={{top: 12, right: 12, bottom: 12, left: 12}}
          onPress={onClose}
          disabled={isSubmitting}>
          <Text style={fS.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={fS.scrollBody}
        keyboardShouldPersistTaps="handled">
        <View style={CC.card}>
          {/* Toggle header */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsExpanded(p => !p)}
            style={CC.toggleRow}>
            <View style={CC.toggleLeft}>
              <Text style={CC.toggleTitle}>Installation Details</Text>
              {/* Collapsed pills */}
              {!isExpanded && (
                <View style={CC.pillRow}>
                  {pitDisplayNo ? (
                    <View style={CC.pill}>
                      <Text style={CC.pillText} numberOfLines={1}>
                        📍 Pit {pitDisplayNo}
                      </Text>
                    </View>
                  ) : null}
                  {displayVendorName ? (
                    <View style={CC.pill}>
                      <Text style={CC.pillText} numberOfLines={1}>
                        🏢 {displayVendorName}
                      </Text>
                    </View>
                  ) : null}
                  {gpsReady && (
                    <View style={[CC.pill, CC.pillGreen]}>
                      <Text style={[CC.pillText, CC.pillTextGreen]}>✓ GPS</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={CC.toggleBadge}>
              <Text style={CC.toggleIcon}>{isExpanded ? '▲' : '▼'}</Text>
              <Text style={CC.toggleLabel}>
                {isExpanded ? 'Collapse' : 'Expand'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Expanded body */}
          {isExpanded && (
            <View style={CC.body}>
              {/* Lat/Long */}
              <View style={CC.gpsRow}>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={CC.fieldLabel}>Lat Long: </Text>
                    {isLoadingGps && isInitialGpsFetch ? (
                      <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                    ) : (
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: FONTS.MEDIUM,
                          color: COLORS.colorDarkslategray,
                          flexShrink: 1,
                        }}
                        numberOfLines={1}>
                        {gpsReady
                          ? `${Number(gpsLat).toFixed(8)}°, ${Number(
                              gpsLong,
                            ).toFixed(8)}°`
                          : '—'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Vendor Name */}
              <View style={CC.fieldBlock}>
                <Text style={CC.fieldLabel}>
                  Vendor Name <Text style={CC.req}>*</Text>
                </Text>

                {isMultiVendor ? (
                  <>
                    <VendorPicker
                      data={vendorList}
                      value={selectedVendor}
                      placeholder="Select Vendor"
                      onSelect={item => {
                        setSelectedVendor(item);
                        if (errors.vendor)
                          setErrors((e: any) => ({...e, vendor: false}));
                      }}
                      hasError={!!errors.vendor}
                    />
                    {errors.vendor && (
                      <Text style={CC.errText}>⚠ Please select a vendor</Text>
                    )}
                  </>
                ) : (
                  <View style={CC.readonlyBox}>
                    <Text style={CC.readonlyText}>
                      {displayVendorName || '—'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Countdown bar */}
              {isCountingDown && (
                <View style={CC.countdownWrap}>
                  <View style={CC.countdownBg}>
                    <View
                      style={[
                        CC.countdownFill,
                        {width: `${((10 - (countdown ?? 0)) / 10) * 100}%`},
                      ]}
                    />
                  </View>
                  <Text
                    style={
                      CC.countdownText
                    }>{`Getting GPS in ${countdown}s…`}</Text>
                </View>
              )}

              {locationError ? (
                <Text style={CC.errText}>{locationError}</Text>
              ) : null}

              {/* ── Duct Stand ── */}
              <View style={fS.rowHalf}>
                <View style={fS.halfCol}>
                  <View style={fS.labelRow}>
                    <Text style={fS.sectionLabel}>Duct Stand</Text>
                    <Text style={fS.required}> *</Text>
                  </View>
                  <View
                    style={errors.ductStand ? fS.pickerErrorWrap : undefined}>
                    <DssCustomPicker
                      data={DUCT_STAND_OPTIONS}
                      value={ductStand}
                      placeholder="Select"
                      labelKey="label"
                      onSelect={(item: any) => {
                        setDuctStand(item);
                        if (errors.ductStand)
                          setErrors((e: any) => ({...e, ductStand: false}));
                      }}
                    />
                  </View>
                  {errors.ductStand && (
                    <Text style={fS.errorText}>⚠ Required</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
        {/* ═══════════════════════════════════════════
              MAIN FORM
          ═══════════════════════════════════════════ */}
        <View style={fS.formCard}>
          <View style={CC.gpsRow}>
            <View style={{flex: 1}}>
              <Text style={CC.gpsHint}>Tap Get GPS to update address</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                CC.gpsBtn,
                (isCountingDown || isLoadingGps) && CC.gpsBtnDisabled,
              ]}
              onPress={handleGetGPS}
              disabled={isCountingDown || isLoadingGps}>
              {isLoadingGps && !isInitialGpsFetch ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={CC.gpsBtnText}>
                  {countdown !== null ? `${countdown}s` : 'Get GPS'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={fS.halfCol}>
            <View style={fS.fieldGroup}>
              <View style={fS.labelRow}>
                <Text style={fS.sectionLabel}>Item Type</Text>
                <Text style={fS.required}> *</Text>
              </View>
              {isLoadingItemTypes ? (
                <View style={fS.loaderRow}>
                  <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                  <Text style={fS.loaderText}>Loading item types…</Text>
                </View>
              ) : (
                <View style={errors.itemType ? fS.pickerErrorWrap : undefined}>
                  <DssCustomPicker
                    data={itemTypePickerData}
                    value={
                      selectedItemType
                        ? {
                            label: selectedItemType.itemName,
                            value: selectedItemType.id,
                          }
                        : null
                    }
                    placeholder="Select Item Type"
                    labelKey="label"
                    onSelect={(item: any) => {
                      const name = item.itemName?.toLowerCase().trim();
                      setSelectedItemType({
                        id: item.id,
                        itemName: item.itemName,
                      });
                      if (errors.itemType)
                        setErrors((e: any) => ({...e, itemType: false}));
                      if (name === 'existing hh' || name === 'existing mh') {
                        dispatch(
                          getNearestPitLatLng({
                            pitLocationId: pit?.chamberId,
                          }),
                        ).then((res: any) => {
                          if (getNearestPitLatLng.fulfilled.match(res))
                            setNearestPitId(Number(res.payload?.id) || 0);
                        });
                      } else setNearestPitId(0);
                    }}
                  />
                </View>
              )}
              {errors.itemType && (
                <Text style={fS.errorText}>⚠ Please select Item Type</Text>
              )}
            </View>
          </View>

          {/* Address */}
          <View style={CC.fieldBlock}>
            <Text style={CC.fieldLabel}>
              Address <Text style={CC.req}>*</Text>
            </Text>
            {isLoadingGps && isInitialGpsFetch ? (
              <ActivityIndicator
                size="small"
                color={COLORS.PRIMARY}
                style={{marginTop: 4}}
              />
            ) : (
              <TextInput
                style={[CC.input, CC.inputMulti, errors.address && CC.inputErr]}
                value={address}
                onChangeText={v => {
                  setAddress(v);
                  if (errors.address)
                    setErrors((e: any) => ({...e, address: false}));
                }}
                placeholder="Address will auto-fill after GPS fetch"
                placeholderTextColor="#aaa"
                multiline
                textAlignVertical="top"
              />
            )}
            {errors.address && (
              <Text style={CC.errText}>⚠ Address is required</Text>
            )}
          </View>
          <View style={CC.fieldBlock}>
            <Text style={CC.fieldLabel}>
              Landmark <Text style={CC.req}>*</Text>
            </Text>
            <TextInput
              style={[CC.input, errors.landmark && CC.inputErr]}
              value={landmark}
              onChangeText={v => {
                setLandmark(v);
                if (errors.landmark)
                  setErrors((e: any) => ({...e, landmark: false}));
              }}
              placeholder="Enter Landmark"
              placeholderTextColor="#aaa"
            />
            {errors.landmark && (
              <Text style={CC.errText}>⚠ Landmark is required</Text>
            )}
          </View>

          {/* ── Images ── */}
          <View style={fS.fieldGroup}>
            <View style={fS.labelRow}>
              <Text style={fS.sectionLabel}>Chamber / Coupler Images</Text>
              <Text style={fS.required}> *</Text>
            </View>

            {(!gpsLat || !gpsLong) && (
              <View style={fS.gpsWarnSmall}>
                <Text style={fS.gpsWarnSmallText}>
                  ⚠ Get GPS first (in card above) — coordinates are burned into
                  photos.
                </Text>
              </View>
            )}
            <View style={fS.imagesRow}>
              <View style={fS.imageCol}>
                <CaptureImageWatermark
                  title="Image 1"
                  pic={pic1}
                  setPic={result => {
                    setPic1(result);
                    if (result && errors.image1)
                      setErrors((e: any) => ({...e, image1: false}));
                  }}
                  lat={gpsLat || ''}
                  long={gpsLong || ''}
                  address={address}
                  hasError={!!errors.image1}
                />
                {errors.image1 && <Text style={fS.errorText}>⚠ Required</Text>}
              </View>
              <View style={fS.imageCol}>
                <CaptureImageWatermark
                  title="Image 2"
                  pic={pic2}
                  setPic={result => {
                    setPic2(result);
                    if (result && errors.image2)
                      setErrors((e: any) => ({...e, image2: false}));
                  }}
                  lat={gpsLat || ''}
                  long={gpsLong || ''}
                  address={address}
                  hasError={!!errors.image2}
                />
                {errors.image2 && <Text style={fS.errorText}>⚠ Required</Text>}
              </View>
            </View>
          </View>

          {/* ── Remarks ── */}
          <View style={fS.fieldGroup}>
            <View style={fS.labelRow}>
              <Text style={fS.sectionLabel}>Remarks</Text>
              <Text style={fS.required}> *</Text>
            </View>
            <View style={[fS.inputWrap, errors.remarks && fS.inputError]}>
              <TextInput
                style={[fS.textInput, {minHeight: 30}]}
                value={remarks}
                onChangeText={v => {
                  setRemarks(v);
                  if (errors.remarks)
                    setErrors((e: any) => ({...e, remarks: false}));
                }}
                placeholder="Enter Remarks"
                placeholderTextColor="#999"
              />
            </View>
            {errors.remarks && (
              <Text style={fS.errorText}>⚠ Remarks are required</Text>
            )}
          </View>

          {/* ── Action Buttons ── */}
          <View style={fS.actionRow}>
            <TouchableOpacity
              style={fS.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}>
              <Text style={fS.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[fS.submitBtn, isSubmitting && fS.btnDisabled]}
              activeOpacity={0.85}
              disabled={isSubmitting}
              onPress={handleSubmit}>
              {isSubmitting ? (
                <View
                  style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={fS.submitBtnText}>Submitting…</Text>
                </View>
              ) : (
                <Text style={fS.submitBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Card Styles  (CC)
// ─────────────────────────────────────────────────────────────────────────────
const CC = StyleSheet.create({
  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    marginBottom: 12,
  },
  gpsHint: {
    fontSize: 10,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.PRIMARY,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  toggleLeft: {flex: 1, gap: 6},
  toggleTitle: {
    fontSize: 14,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    letterSpacing: 0.2,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  pill: {
    backgroundColor: '#F0F4FF',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#C7D7F5',
    maxWidth: 150,
  },
  pillGreen: {backgroundColor: '#E8F5E9', borderColor: '#B2DFBB'},
  pillText: {fontSize: 10, fontFamily: FONTS.MEDIUM, color: '#3A5BA0'},
  pillTextGreen: {color: '#2E7D32'},
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  toggleIcon: {fontSize: 11, color: '#fff', fontFamily: FONTS.SEMI_BOLD},
  toggleLabel: {fontSize: 12, fontFamily: FONTS.SEMI_BOLD, color: '#fff'},
  body: {paddingHorizontal: 14, paddingBottom: 16, gap: 12},
  gpsRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  gpsBtn: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  gpsBtnText: {
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#fff',
    letterSpacing: 0.3,
  },
  gpsBtnDisabled: {opacity: 0.6},
  countdownWrap: {gap: 4},
  countdownBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  countdownFill: {height: 4, backgroundColor: COLORS.PRIMARY, borderRadius: 4},
  countdownText: {
    fontSize: 11,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
  },
  bannerBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
  },
  bannerBlueText: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
  },
  bannerOrange: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  bannerOrangeText: {
    fontSize: 12,
    color: '#E65100',
    fontFamily: FONTS.REGULAR,
    lineHeight: 17,
  },
  bannerGreen: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  bannerGreenText: {fontSize: 12, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
  errText: {
    fontSize: 12,
    color: COLORS.ERROR ?? '#f44',
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
  },
  fieldBlock: {gap: 6},
  fieldLabel: {
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
  },
  req: {color: COLORS.colorRed ?? '#f44'},
  input: {
    borderWidth: 1,
    borderColor: '#DDE4EE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    backgroundColor: COLORS.colorWhite,
    minHeight: 40,
  },
  inputMulti: {minHeight: 60, textAlignVertical: 'top'},
  inputErr: {borderColor: COLORS.ERROR ?? '#f44'},
  readonlyBox: {
    borderWidth: 1,
    borderColor: '#DDE4EE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F7F9FB',
    minHeight: 40,
    justifyContent: 'center',
  },
  readonlyText: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Form card styles  (fS)
// ─────────────────────────────────────────────────────────────────────────────
const fS = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEDED',
  },
  headerLeft: {gap: 4},
  pitTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderWidth: 1.5,
    borderColor: '#F57C00',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pitTypeBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#E65100',
  },
  headerPitNo: {
    fontSize: 15,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1a1a1a',
    marginTop: 4,
  },
  closeBtn: {fontSize: 22, color: '#555', paddingHorizontal: 4, paddingTop: 2},
  scrollBody: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 14,
    gap: 0,
  },
  infoBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 12,
    gap: 3,
  },
  infoRow: {fontSize: 12, fontFamily: FONTS.REGULAR, color: '#495057'},
  infoLabel: {fontFamily: FONTS.SEMI_BOLD, color: '#343A40'},
  infoValue: {fontFamily: FONTS.REGULAR},
  formCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 14,
    padding: 14,
    gap: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  fieldGroup: {gap: 8},
  labelRow: {flexDirection: 'row', alignItems: 'center'},
  sectionLabel: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  required: {
    color: COLORS.colorRed ?? '#f44',
    fontSize: 14,
    fontFamily: FONTS.MEDIUM,
  },
  btnDisabled: {opacity: 0.6},
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loaderText: {fontSize: 13, color: COLORS.PRIMARY, fontFamily: FONTS.REGULAR},
  pickerErrorWrap: {
    borderWidth: 1,
    borderColor: COLORS.ERROR ?? '#f44',
    borderRadius: 6,
  },
  rowHalf: {flexDirection: 'row', gap: 10},
  halfCol: {flex: 1, gap: 6},
  gpsWarnSmall: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  gpsWarnSmallText: {
    fontSize: 11,
    color: '#E65100',
    fontFamily: FONTS.REGULAR,
    lineHeight: 16,
  },
  imagesRow: {flexDirection: 'row', gap: 12},
  imageCol: {flex: 1, gap: 4},
  inputWrap: {
    borderWidth: 1,
    borderColor: '#E6EEF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  inputError: {borderColor: COLORS.ERROR ?? '#f44', borderWidth: 1.5},
  textInput: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    paddingVertical: 4,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.ERROR ?? '#f44',
    marginTop: 2,
    fontFamily: FONTS.REGULAR,
  },
  actionRow: {flexDirection: 'row', gap: 10, marginTop: 6},
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F1F3F5',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  cancelBtnText: {fontSize: 14, fontFamily: FONTS.MEDIUM, color: '#495057'},
  submitBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
  },
  submitBtnText: {fontSize: 14, fontFamily: FONTS.SEMI_BOLD, color: '#fff'},
});

// ── Main Screen ───────────────────────────────────────────────────────────────
const FiberBlowing: FC<ScreenProps.FiberBlowing> = ({navigation, route}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    projectId,
    projectCode,
    spRoute,
    epRoute,
    projectName,
    vendorID,
    vendorCode,
    vendorName,
    distanceFromUser,
    startPoint,
    endPoint,
  } = route.params;
  const cacheKey = String(projectId);

  const [pitTypeModal, setPitTypeModal] = useState<{
    visible: boolean;
    pit: PitItem | null;
    pitIndex: number;
  }>({
    visible: false,
    pit: null,
    pitIndex: -1,
  });

  const [ductList, setDuctList] = useState<DuctItem[]>([]);
  const [selectedDuct, setSelectedDuct] = useState<DuctItem | null>(null);
  const selectedDuctRef = useRef<DuctItem | null>(null);
  const [colorLoading, setColorLoading] = useState(true);

  const [pitList, setPitList] = useState<PitItem[]>(
    () => pitListCache[cacheKey] ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [userPastLastPit, setUserPastLastPit] = useState(false);

  const [betweenPrevDistance, setBetweenPrevDistance] = useState<number | null>(
    null,
  );
  const [betweenNextDistance, setBetweenNextDistance] = useState<number | null>(
    null,
  );
  const [distanceFromProjectEnd, setDistanceFromProjectEnd] =
    useState<number>(0);
  const [isPastProjectEnd, setIsPastProjectEnd] = useState<boolean>(false);
  const getInsertIndex = (
    point: {lat: number; lng: number} | null,
    pits: any[],
  ) => {
    if (!point || pits.length === 0) return -1;
    if (pits.length === 1) return 0;

    let bestIndex = -1;
    let bestScore = Number.MAX_VALUE;

    for (let i = 0; i < pits.length - 1; i++) {
      const a = pits[i];
      const b = pits[i + 1];

      const latA = parseFloat(a.lat);
      const lngA = parseFloat(a.lon);
      const latB = parseFloat(b.lat);
      const lngB = parseFloat(b.lon);

      if (isNaN(latA) || isNaN(lngA) || isNaN(latB) || isNaN(lngB)) {
        continue;
      }

      const {t, perp} = segmentCheck(
        point.lat,
        point.lng,
        latA,
        lngA,
        latB,
        lngB,
      );

      if (t < -0.35 || t > 1.35) continue;

      const tClamp = Math.max(0, Math.min(1, t));

      const projLat = latA + (latB - latA) * tClamp;
      const projLng = lngA + (lngB - lngA) * tClamp;

      const projectionDistance = haversineDistance(
        point.lat,
        point.lng,
        projLat,
        projLng,
      );

      const midDistance = haversineDistance(
        point.lat,
        point.lng,
        (latA + latB) / 2,
        (lngA + lngB) / 2,
      );

      const segmentLength = haversineDistance(latA, lngA, latB, lngB);

      const tPenalty =
        t < 0 ? Math.abs(t) * 40 : t > 1 ? Math.abs(t - 1) * 40 : 0;

      const score =
        projectionDistance * 0.6 +
        perp * 0.2 +
        midDistance * 0.15 +
        tPenalty +
        segmentLength * 0.02;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex !== -1) {
      return bestIndex;
    }

    const first = pits[0];
    const last = pits[pits.length - 1];

    const dFirst = haversineDistance(
      point.lat,
      point.lng,
      parseFloat(first.lat),
      parseFloat(first.lon),
    );

    const dLast = haversineDistance(
      point.lat,
      point.lng,
      parseFloat(last.lat),
      parseFloat(last.lon),
    );

    return dFirst <= dLast ? -1 : pits.length - 1;
  };

  const projectStart = React.useMemo(() => {
    if (!startPoint) return null;
    const [lat, lng] = startPoint.split(',').map(Number);
    return {lat, lng};
  }, [startPoint]);

  const projectEnd = React.useMemo(() => {
    if (!endPoint) return null;
    const [lat, lng] = endPoint.split(',').map(Number);
    return {lat, lng};
  }, [endPoint]);

  const startInsertIndex = React.useMemo(
    () => getInsertIndex(projectStart, pitList),
    [projectStart, pitList],
  );

  const endInsertIndex = React.useMemo(
    () => getInsertIndex(projectEnd, pitList),
    [projectEnd, pitList],
  );
  const openShotId = useSelector((state: any) => state.dss?.openShotId);
  const [galleryData, setGalleryData] = useState<GalleryItem | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords>(null);
  const [isOutOfProject, setIsOutOfProject] = useState(false);
  const [activeBetweenIndex, setActiveBetweenIndex] = useState<number>(-1);
  const pinAnimRef = useRef<any>(null);
  const [userAtLastPit, setUserAtLastPit] = useState<boolean>(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [nearestPitId, setNearestPitId] = useState<string | null>(null);
  const [nearestPitLabel, setNearestPitLabel] = useState<string>('');
  const [nearestPitLabel2, setNearestPitLabel2] = useState<string>('');

  const [nearestPitDistM, setNearestPitDistM] = useState<number>(Infinity);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const [betweenRowHeights, setBetweenRowHeights] = useState<
    Record<number, number>
  >({});
  const [activePitLoading, setActivePitLoading] = useState(false);
  const [distanceFromLastPit, setDistanceFromLastPit] =
    useState<number>(Infinity);
  const [dashColHeight, setDashColHeight] = useState<number>(0);
  const [pitDistances, setPitDistances] = useState<Record<string, number>>({});
  const pitDistancesRef = useRef<Record<string, number>>({});

  // ─────────────────────────────────────────────────────────────────────────
  // NEW STATE: directionLock
  // 'none'     → no direction chosen yet (fresh start OR middle start before
  //              any second install)
  // 'forward'  → user picked forward direction; backward locked
  // 'backward' → user picked backward direction; forward locked
  // ─────────────────────────────────────────────────────────────────────────
  const [directionLock, setDirectionLock] = useState<DirectionLock>('none');
  const directionLockRef = useRef<DirectionLock>('none');

  // Sync ref
  useEffect(() => {
    directionLockRef.current = directionLock;
  }, [directionLock]);

  // ─────────────────────────────────────────────────────────────────────────
  // lastInstalledChamberId — same as before
  // ─────────────────────────────────────────────────────────────────────────
  const [lastInstalledChamberId, setLastInstalledChamberId] = useState<
    number | null
  >(null);
  const lastInstalledChamberIdRef = useRef<number | null>(null);

  useEffect(() => {
    lastInstalledChamberIdRef.current = lastInstalledChamberId;
  }, [lastInstalledChamberId]);

  // Derive lastInstalledChamberId + directionLock from freshly-loaded pitList
  useEffect(() => {
    if (!pitList || pitList.length === 0) return;
    const hasAnyInstalled = pitList.some(p => isPitBlown(p.blowingStatus));
    if (!hasAnyInstalled) {
      setLastInstalledChamberId(null);
      // ── Fresh start: always reset direction lock ──
      setDirectionLock('none');
      directionLockRef.current = 'none';
      return;
    }

    const openIndex = pitList.findIndex(
      p =>
        p.isShotOpen === true || p.isOpenForShot === true || p.isOpen === true,
    );
    if (openIndex > 0 && isPitBlown(pitList[openIndex - 1]?.blowingStatus)) {
      setLastInstalledChamberId(Number(pitList[openIndex - 1]?.chamberId ?? 0));
    } else if (
      openIndex >= 0 &&
      openIndex < pitList.length - 1 &&
      isPitBlown(pitList[openIndex + 1]?.blowingStatus)
    ) {
      setLastInstalledChamberId(Number(pitList[openIndex + 1]?.chamberId ?? 0));
    } else {
      const installedPits = pitList.filter(p => isPitBlown(p.blowingStatus));
      if (installedPits.length > 0) {
        setLastInstalledChamberId(
          Number(installedPits[installedPits.length - 1]?.chamberId ?? 0),
        );
      }
    }

    // ── On fresh load: detect direction from pitList state ────────────────
    // If chain is already in progress (e.g. user re-opens screen mid-chain),
    // detect the direction from the installed/open pattern.
    // We only set this if directionLock is currently 'none' to avoid
    // overwriting a lock the user already set in this session.
    if (directionLockRef.current === 'none') {
      const installedIndexes = pitList
        .map((p, i) => (isPitBlown(p.blowingStatus) ? i : -1))
        .filter(i => i !== -1);

      const openIndexes = pitList
        .map((p, i) =>
          p.isShotOpen === true || p.isOpenForShot === true || p.isOpen === true
            ? i
            : -1,
        )
        .filter(i => i !== -1);

      if (installedIndexes.length > 0 && openIndexes.length > 0) {
        const lastInstalled = installedIndexes[installedIndexes.length - 1];
        const firstOpen = openIndexes[0];

        // If all open pits are forward of last installed → forward chain
        const allForward = openIndexes.every(i => i > lastInstalled);
        const allBackward = openIndexes.every(i => i < lastInstalled);

        // Only auto-lock if unambiguous (all open on one side)
        // If mixed (both sides open) keep 'none' — middle start scenario
        if (allForward && !allBackward) {
          setDirectionLock('forward');
          directionLockRef.current = 'forward';
        } else if (allBackward && !allForward) {
          setDirectionLock('backward');
          directionLockRef.current = 'backward';
        }
        // else: keep 'none' (middle start — both directions available)
      }
    }
  }, [pitList]);

  // ── Memoised clickable pit set — now uses directionLock ──────────────────
  const clickablePitIds = useMemo(
    () => getClickablePitIds(pitList, directionLock),
    [pitList, directionLock],
  );

  const calledOpenShotIdsRef = useRef<Set<number>>(new Set());
  const watchIdRef = useRef<number | null>(null);
  const toastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const pitListRef = useRef<PitItem[]>(pitListCache[cacheKey] ?? []);
  const projectEndRef = useRef<{lat: number; lng: number} | null>(null);
  const projectEndAnchorRef = useRef<{lat: number; lng: number} | null>(null);
  const projectStartRef = useRef<{lat: number; lng: number} | null>(null);
  useEffect(() => {
    projectStartRef.current = projectStart;
  }, [projectStart]);

  useEffect(() => {
    projectEndRef.current = projectEnd;

    if (!projectEnd || !pitList?.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchorIdx = endInsertIndex >= 0 ? endInsertIndex : pitList.length - 1;

    if (anchorIdx < 0 || anchorIdx >= pitList.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchor = pitList[anchorIdx];
    const aLat = parseFloat(anchor?.lat ?? '0');
    const aLng = parseFloat(anchor?.lon ?? '0');

    if (isNaN(aLat) || isNaN(aLng) || (aLat === 0 && aLng === 0)) {
      projectEndAnchorRef.current = null;
      return;
    }

    projectEndAnchorRef.current = {lat: aLat, lng: aLng};
  }, [projectEnd, pitList, endInsertIndex]);
  useEffect(() => {
    projectEndRef.current = projectEnd;

    if (!projectEnd || !pitList?.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchorIdx = endInsertIndex >= 0 ? endInsertIndex : pitList.length - 1;

    if (anchorIdx < 0 || anchorIdx >= pitList.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchor = pitList[anchorIdx];
    const aLat = parseFloat(anchor?.lat ?? '0');
    const aLng = parseFloat(anchor?.lon ?? '0');

    if (isNaN(aLat) || isNaN(aLng) || (aLat === 0 && aLng === 0)) {
      projectEndAnchorRef.current = null;
      return;
    }

    projectEndAnchorRef.current = {lat: aLat, lng: aLng};
  }, [projectEnd, pitList, endInsertIndex]);
  const pitSpatialIndexRef = useRef<any[]>([]);
  const lastNearestCheck = useRef(0);
  const findNearestRef = useRef<((lat: number, lng: number) => void) | null>(
    null,
  );
  const updateLocationStateRef = useRef<
    ((lat: number, lng: number) => void) | null
  >(null);
  const isLoadingRef = useRef(false);
  const userCoordsRef = useRef<UserCoords>(null);
  const AT_LAST_PIT_TOL_M = 15;

  useEffect(() => {
    const fetchDucts = async () => {
      try {
        setColorLoading(true);
        const result = await dispatch(
          getProjectDuctColorDDAPI({RoadProjectIds: Number(projectId)}),
        ).unwrap();
        const rawList = Array.isArray(result) ? result : result?.data ?? [];
        const unique: DuctItem[] = rawList.map((item: any) => ({
          ductNo: item.ductNo,
        }));
        setDuctList(unique);
        if (unique.length === 1) {
          setSelectedDuct(unique[0]);
          selectedDuctRef.current = unique[0];
          fetchPitList(unique[0].ductNo);
        }
      } catch (err) {
        console.error(err);
        setDuctList([]);
      } finally {
        setColorLoading(false);
      }
    };
    fetchDucts();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    pitListRef.current = pitList;
    if (pitList.length > 0) pitListCache[cacheKey] = pitList;
    pitSpatialIndexRef.current = pitList.map(p => ({
      ...p,
      latNum: parseFloat(p?.lat ?? '0'),
      lngNum: parseFloat(p?.lon ?? '0'),
    }));
  }, [pitList, cacheKey]);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);
  useEffect(() => {
    pitDistancesRef.current = pitDistances;
  }, [pitDistances]);

  const recomputePitDistances = useCallback((lat: number, lng: number) => {
    if (!lat || !lng || (lat === 0 && lng === 0)) return;
    const list = pitListRef.current;
    if (!list?.length) return;
    const newDists: Record<string, number> = {};
    list.forEach((p, idx) => {
      const pLat = parseFloat(p?.lat ?? '0');
      const pLng = parseFloat(p?.lon ?? '0');
      if (!isNaN(pLat) && !isNaN(pLng) && (pLat !== 0 || pLng !== 0)) {
        const cardId = String(p?.pitLocationId ?? p?.pitNo ?? idx);
        newDists[cardId] = haversineDistance(lat, lng, pLat, pLng);
      }
    });
    pitDistancesRef.current = newDists;
    setPitDistances(newDists);
  }, []);

  const isUserAtOrPastLastPit = (
    userLat: number,
    userLng: number,
    list: any[],
  ): boolean => {
    if (!list || list.length === 0) return false;
    const lastPit = list[list.length - 1];
    const prevPit = list.length > 1 ? list[list.length - 2] : null;
    const lastLat = parseFloat(lastPit?.lat ?? '0');
    const lastLng = parseFloat(lastPit?.lon ?? '0');
    if (isNaN(lastLat) || isNaN(lastLng)) return false;
    const dist = haversineDistance(userLat, userLng, lastLat, lastLng);
    if (dist <= 10) return true;
    if (prevPit) {
      const prevLat = parseFloat(prevPit?.lat ?? '0');
      const prevLng = parseFloat(prevPit?.lon ?? '0');
      if (!isNaN(prevLat) && !isNaN(prevLng)) {
        const {t} = segmentCheck(
          userLat,
          userLng,
          prevLat,
          prevLng,
          lastLat,
          lastLng,
        );
        if (t > 0.95) return true;
      }
    }
    return false;
  };

  const pendingDistanceLabel = React.useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';
    let pendingMeters = 0;
    for (let i = 0; i < pitList.length - 1; i++) {
      const currentPit = pitList[i];
      const nextPit = pitList[i + 1];
      if (
        !isPitBlown(currentPit?.blowingStatus) ||
        !isPitBlown(nextPit?.blowingStatus)
      ) {
        const lat1 = parseFloat(currentPit?.lat ?? '0');
        const lng1 = parseFloat(currentPit?.lon ?? '0');
        const lat2 = parseFloat(nextPit?.lat ?? '0');
        const lng2 = parseFloat(nextPit?.lon ?? '0');
        if (
          !isNaN(lat1) &&
          !isNaN(lng1) &&
          !isNaN(lat2) &&
          !isNaN(lng2) &&
          !(lat1 === 0 && lng1 === 0) &&
          !(lat2 === 0 && lng2 === 0)
        )
          pendingMeters += haversineDistance(lat1, lng1, lat2, lng2);
      }
    }
    return formatDistance(pendingMeters);
  }, [pitList]);

  const getNearestPitDistance = (userLat: number, userLng: number) => {
    const pits = pitSpatialIndexRef.current;
    let min = Infinity;
    for (let i = 0; i < pits.length; i++) {
      const lat = pits[i].latNum;
      const lng = pits[i].lngNum;
      if (!lat || !lng) continue;
      const d = haversineDistance(userLat, userLng, lat, lng);
      if (d < min) {
        min = d;
        if (min < 6) break;
      }
    }
    return min;
  };
  const handleViewOnMap = async (
    lat: string | number | undefined,
    lng: string | number | undefined,
    pitNo: string,
  ) => {
    const pitLat = parseFloat(String(lat ?? '0'));
    const pitLng = parseFloat(String(lng ?? '0'));

    if (isNaN(pitLat) || isNaN(pitLng) || (pitLat === 0 && pitLng === 0)) {
      Alert.alert('Invalid Location', 'Pit coordinates are not available.');
      return;
    }

    try {
      // Get current location
      const {latitude, longitude} = await getCurrentPosition();

      // Build the URL for navigation
      const url =
        Platform.OS === 'ios'
          ? `http://maps.apple.com/?saddr=${latitude},${longitude}&daddr=${pitLat},${pitLng}&dirflg=d`
          : `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${pitLat},${pitLng}&travelmode=driving`;

      // Check if the URL can be opened
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to web
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${pitLat},${pitLng}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback: Open maps with just the destination
      try {
        const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${pitLat},${pitLng}`;
        await Linking.openURL(fallbackUrl);
      } catch (e) {
        Alert.alert(
          'Navigation Error',
          'Unable to open maps. Please try again later.',
        );
      }
    }
  };
  const updateLocationState = useCallback((lat: number, lng: number) => {
    if (lat === 0 && lng === 0) return;
    const list = pitListRef.current;
    if (!list?.length) return;

    const last = list[list.length - 1];
    const lastLat = parseFloat(last?.lat ?? '0');
    const lastLng = parseFloat(last?.lon ?? '0'); // ✅ fixed: was last?.lng
    let distFromLast = Infinity;
    if (!isNaN(lastLat) && !isNaN(lastLng)) {
      distFromLast = haversineDistance(lat, lng, lastLat, lastLng);
    }
    setDistanceFromLastPit(distFromLast);
    const pEnd = projectEndRef.current;

    if (pEnd) {
      const distToEnd = haversineDistance(lat, lng, pEnd.lat, pEnd.lng);
      setDistanceFromProjectEnd(distToEnd);

      const anchor = projectEndAnchorRef.current;

      if (anchor) {
        const {t} = segmentCheck(
          lat,
          lng,
          anchor.lat,
          anchor.lng,
          pEnd.lat,
          pEnd.lng,
        );
        setIsPastProjectEnd(t > 1);
      } else {
        setIsPastProjectEnd(false);
      }
    } else {
      setDistanceFromProjectEnd(0);
      setIsPastProjectEnd(false);
    }
    if (distFromLast > 500) {
      setIsOutOfProject(true);
      setActiveBetweenIndex(-1);
      setUserAtLastPit(false);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    } else {
      setIsOutOfProject(false);
    }

    const nearestDist = getNearestPitDistance(lat, lng);
    if (nearestDist < 30) {
      if (distFromLast <= AT_LAST_PIT_TOL_M) {
        setUserAtLastPit(true);
      } else {
        setUserAtLastPit(false);
      }
      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    }

    const atLast = isUserAtOrPastLastPit(lat, lng, list);
    if (atLast) {
      setUserAtLastPit(true);
      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    }
    setUserAtLastPit(false);

    const betweenIndex = findActiveBetweenIndex(lat, lng, list);
    if (betweenIndex >= 0) {
      const prevPitItem = list[betweenIndex];
      const nextPitItem = list[betweenIndex + 1];

      const prevLat = parseFloat(prevPitItem?.lat ?? '0');
      const prevLng = parseFloat(prevPitItem?.lon ?? '0'); // ✅ fixed: was ?.lng
      const nextLat = parseFloat(nextPitItem?.lat ?? '0');
      const nextLng = parseFloat(nextPitItem?.lon ?? '0'); // ✅ fixed: was ?.lng

      if (
        !isNaN(prevLat) &&
        !isNaN(prevLng) &&
        (prevLat !== 0 || prevLng !== 0)
      ) {
        setBetweenPrevDistance(haversineDistance(lat, lng, prevLat, prevLng));
      } else {
        setBetweenPrevDistance(null);
      }

      if (
        !isNaN(nextLat) &&
        !isNaN(nextLng) &&
        (nextLat !== 0 || nextLng !== 0)
      ) {
        setBetweenNextDistance(haversineDistance(lat, lng, nextLat, nextLng));
      } else {
        setBetweenNextDistance(null);
      }

      setActiveBetweenIndex(betweenIndex);
      setUserAtLastPit(false);
      return;
    }
    setBetweenPrevDistance(null);
    setBetweenNextDistance(null);
    setActiveBetweenIndex(prev =>
      prev === betweenIndex ? prev : betweenIndex,
    );
  }, []);

  useEffect(() => {
    updateLocationStateRef.current = updateLocationState;
  }, [updateLocationState]);

  const startGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;
    watchIdRef.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, accuracy} = position.coords;
        if (!accuracy || accuracy > 35) return;
        setUserCoords(prev => {
          const smooth = smoothCoords(prev, {latitude, longitude});
          updateLocationStateRef.current?.(smooth.latitude, smooth.longitude);
          findNearestRef.current?.(smooth.latitude, smooth.longitude);
          recomputePitDistances(smooth.latitude, smooth.longitude);
          return smooth;
        });
      },
      error => {
        console.warn('[GPS Watch Error]', error.code, error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 1000,
        fastestInterval: 800,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  }, [recomputePitDistances]);

  const stopGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (toastIntervalRef.current) {
      clearInterval(toastIntervalRef.current);
      toastIntervalRef.current = null;
    }
  }, []);

  const findNearest = useCallback((latitude: number, longitude: number) => {
    const now = Date.now();
    if (now - lastNearestCheck.current < 800) return;
    lastNearestCheck.current = now;
    if (!latitude || !longitude || (latitude === 0 && longitude === 0)) return;
    const list = pitListRef.current;
    if (!list || list.length === 0) return;
    let minDist = Infinity;
    let closestId: string | null = null;
    let closestLabel = '';
    let closestLabel2 = '';
    list.forEach(item => {
      const pLat = parseFloat(item?.lat ?? '0');
      const pLng = parseFloat(item?.lon ?? '0');
      if (!isNaN(pLat) && !isNaN(pLng) && (pLat !== 0 || pLng !== 0)) {
        const d = haversineDistance(latitude, longitude, pLat, pLng);
        if (d < minDist) {
          minDist = d;
          closestId = String(item?.pitLocationId ?? item?.pitNo ?? '');
          closestLabel = `PIT - ${displayPitNo(item?.pitNo ?? '')}  (${
            d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`
          } away)`;
          closestLabel2 = `PIT - ${displayPitNo(item?.pitNo ?? '')}\n${
            d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`
          }\naway`;
        }
      }
    });
    if (closestId) {
      setNearestPitId(closestId);
      setNearestPitLabel(closestLabel);
      setNearestPitLabel2(closestLabel2);
      setNearestPitDistM(minDist);
      setPinVisible(true);
    } else setPinVisible(false);
  }, []);

  useEffect(() => {
    findNearestRef.current = findNearest;
  }, [findNearest]);

  const fetchPitList = useCallback(
    async (ductNo: number) => {
      try {
        isLoadingRef.current = true;
        setIsLoading(true);
        setActivePitLoading(true);

        const result = await dispatch(
          getSLDEReportAPI({projectId: Number(projectId), ductNo}),
        ).unwrap();

        const rawList = Array.isArray(result) ? result : result?.data ?? [];

        const newList: PitItem[] = rawList.map((item: any) => ({
          ...item,
          pitLocationId: Number(item?.pitId ?? 0),
          lat: String(item?.lat ?? '0'),
          lon: String(item?.lon ?? '0'),
          distance: Number(item?.distance ?? 0),
        }));

        setPitList(newList);
      } catch (error) {
        console.error('Failed to fetch pit list:', error);
        setPitList([]);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [dispatch, projectId],
  );

  const fetchPitListRef = useRef(fetchPitList);
  useEffect(() => {
    fetchPitListRef.current = fetchPitList;
  }, [fetchPitList]);

  const initGPS = useCallback(() => {
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setUserCoords({latitude, longitude});
        userCoordsRef.current = {latitude, longitude};
        updateLocationState(latitude, longitude);
        lastNearestCheck.current = 0;
        findNearest(latitude, longitude);
        recomputePitDistances(latitude, longitude);
      })
      .catch(() => {});
  }, [updateLocationState, findNearest, recomputePitDistances]);

  const initGPSRef = useRef(initGPS);
  useEffect(() => {
    initGPSRef.current = initGPS;
  }, [initGPS]);
  useFocusEffect(
    useCallback(() => {
      calledOpenShotIdsRef.current = new Set();
      startGPSWatch();
      if (selectedDuctRef.current)
        fetchPitListRef.current?.(selectedDuctRef.current.ductNo);
      initGPSRef.current?.();
      return () => {
        stopGPSWatch();
      };
    }, [startGPSWatch, stopGPSWatch]),
  );
  const handleDuctSelect = useCallback(
    (item: DuctItem) => {
      setSelectedDuct(item); // ✅ YEH FIX KARO - (item) add karo
      selectedDuctRef.current = item;
      setPitList([]);
      setPitDistances({});
      pitDistancesRef.current = {};
      setLastInstalledChamberId(null);
      // Reset direction lock when duct changes
      setDirectionLock('none');
      directionLockRef.current = 'none';
      fetchPitList(item.ductNo);
    },
    [fetchPitList],
  );

  useEffect(() => {
    if (userCoords && pitListRef.current.length > 0)
      updateLocationState(userCoords.latitude, userCoords.longitude);
  }, [userCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pitList && pitList.length > 0) {
      const coords = userCoordsRef.current;
      if (coords) {
        updateLocationState(coords.latitude, coords.longitude);
        lastNearestCheck.current = 0;
        findNearestRef.current?.(coords.latitude, coords.longitude);
        recomputePitDistances(coords.latitude, coords.longitude);
      } else {
        getCurrentPosition()
          .then(({latitude, longitude}) => {
            setUserCoords({latitude, longitude});
            updateLocationState(latitude, longitude);
            lastNearestCheck.current = 0;
            findNearestRef.current?.(latitude, longitude);
            recomputePitDistances(latitude, longitude);
          })
          .catch(() => {});
      }
    }
  }, [pitList]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeout(() => {
      if (pinAnimRef.current) {
        if (activeBetweenIndex >= 0) pinAnimRef.current.pulse?.(500);
        else pinAnimRef.current.rubberBand?.(600);
      }
    }, 150);
  }, [activeBetweenIndex]);

  useEffect(() => {
    if (!isLoading) setActivePitLoading(false);
  }, [isLoading]);

  const handleWhereAmI = useCallback(() => {
    if (isLoadingRef.current) return;
    if (!pitListRef.current || pitListRef.current.length === 0) return;
    setLocLoading(true);
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setUserCoords({latitude, longitude});
        userCoordsRef.current = {latitude, longitude};
        updateLocationState(latitude, longitude);
        setLocLoading(false);
        lastNearestCheck.current = 0;
        findNearest(latitude, longitude);
        recomputePitDistances(latitude, longitude);
      })
      .catch(() => {
        setLocLoading(false);
        Alert.alert(
          'Location Error',
          'Unable to get your location.\n\nPlease enable GPS.',
        );
      });
  }, [updateLocationState, findNearest, recomputePitDistances]);

  // ── Open Default Coupler modal ─────────────────────────────────────────────
  const handleOpenDefaultCouplerModal = useCallback(
    (pit: PitItem, pitIndex: number) => {
      if (!selectedDuctRef.current) {
        Alert.alert('Error', 'Please select duct first');
        return;
      }
      setPitTypeModal({visible: true, pit, pitIndex});
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATED: handlePitPress
  // Now also updates directionLock when user picks a direction from the
  // middle-start scenario (directionLock === 'none' + installed pits exist)
  // ─────────────────────────────────────────────────────────────────────────
  const handlePitPress = useCallback(
    (pit: PitItem, pitIndex: number) => {
      if (!selectedDuctRef.current) {
        Alert.alert('Error', 'Please select duct first');
        return;
      }

      // Check if this pit is in the clickable set
      if (!clickablePitIds.has(pit.pitLocationId)) {
        Alert.alert(
          'Not Available',
          'This chamber is not available for Fiber Blowing yet.\n\nPlease complete the adjacent chamber first.',
          [{text: 'OK'}],
        );
        return;
      }

      // ── Direction lock update ─────────────────────────────────────────────
      // If direction is currently 'none' AND there are already installed pits,
      // this press is the first in a direction from middle-start.
      // Lock the direction now so the other side gets disabled.
      if (directionLockRef.current === 'none') {
        const list = pitListRef.current;
        const hasInstalled = list.some(p => isPitBlown(p.blowingStatus));
        if (hasInstalled) {
          const chosenDirection = detectClickDirection(pitIndex, list);
          if (chosenDirection !== 'none') {
            setDirectionLock(chosenDirection);
            directionLockRef.current = chosenDirection;
            console.log('🔒 Direction locked:', chosenDirection);
          }
        }
      }

      const pitTypeValue = String(pit?.pitType || pit?.itemName || '')
        .trim()
        .toLowerCase();

      console.log('PIT TYPE =>', pitTypeValue);

      if (
        pitTypeValue.includes('default coupler') ||
        pitTypeValue.includes('defaultcoupler')
      ) {
        console.log('OPENING INSTALLATION FORM MODAL FOR DEFAULT COUPLER');
        setPitTypeModal({visible: true, pit, pitIndex});
        return;
      }

      navigateToAddFiberBlowing(pit, pitIndex);
    },
    [clickablePitIds], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─────────────────────────────────────────────────────────────────────────
  // navigateToAddFiberBlowing — same logic as before
  // ─────────────────────────────────────────────────────────────────────────
  const navigateToAddFiberBlowing = useCallback(
    (pit: PitItem, pitIndex: number) => {
      if (!selectedDuctRef.current) {
        Alert.alert('Error', 'Please select duct first');
        return;
      }

      const isCouplerPit = String(pit?.pitType || pit?.itemName || '')
        .trim()
        .toLowerCase()
        .includes('coupler');
      // ❌ Fresh start par coupler se blowing start nahi hogi
      const hasAnyInstalledPit = (pitListRef.current || []).some(p =>
        isPitBlown(p?.blowingStatus),
      );

      if (!hasAnyInstalledPit && isCouplerPit) {
        Alert.alert(
          'Not Allowed',
          'Coupler should not start with coupler pit.',
        );
        return;
      }
      const list = pitListRef.current || [];
      const currentChamberId = Number(pit?.chamberId ?? 0);

      // ── Find the immediately adjacent installed pit in the direction of travel ──
      // We look at the pit directly next to the clicked pit (above or below),
      // favouring the direction we came from based on directionLock.
      // This ensures: 3→4 sends from=3,to=4; 4→5 sends from=4,to=5; etc.
      const findAdjacentInstalledChamberId = (): number | null => {
        // Check immediate previous pit
        if (pitIndex > 0 && isPitBlown(list[pitIndex - 1]?.blowingStatus)) {
          return Number(list[pitIndex - 1]?.chamberId ?? 0);
        }

        // Check immediate next pit
        if (
          pitIndex < list.length - 1 &&
          isPitBlown(list[pitIndex + 1]?.blowingStatus)
        ) {
          return Number(list[pitIndex + 1]?.chamberId ?? 0);
        }

        return null;
      };

      // ── Determine fromChamberInstallationId ───────────────────────────────
      // Priority:
      // 1. If ref has a value from THIS session's previous press → use it
      //    (handles same-session chain: 3→4→5→6 within one focus)
      // 2. Else check immediate neighbor in direction of travel from pitList
      //    (handles re-focus: came back to screen, ref was reset to null)
      // 3. Nothing installed → true first install → from = to = currentChamberId
      // Always take the chamber id of the adjacent installed pit
      const resolvedPrevChamberId = findAdjacentInstalledChamberId();

      const isFirstInstallation = resolvedPrevChamberId === null;

      const fromChamberInstallationId = isFirstInstallation
        ? currentChamberId
        : resolvedPrevChamberId;

      const toChamberInstallationId = currentChamberId;

      const loopData = isCouplerPit ? 0 : Number(pit?.loop ?? 0);

      const segmentDistanceFromUser = isFirstInstallation
        ? 0
        : Number(pit?.distance ?? 0);

      console.log('📤 navigateToAddFiberBlowing =>', {
        pitNo: pit.pitNo,
        pitIndex,
        isFirstInstallation,
        fromChamberInstallationId,
        toChamberInstallationId,
        lastInstalledChamberIdRef_value: lastInstalledChamberIdRef.current,
        resolvedPrevChamberId,
        directionLock: directionLockRef.current,
      });
      // ── Optimistic update AFTER computing from/to ─────────────────────────
      setLastInstalledChamberId(currentChamberId);
      lastInstalledChamberIdRef.current = currentChamberId;

      navigation.navigate('AddFiberBlowing', {
        projectId: String(projectId),
        projectCode: String(projectCode),
        projectName: String(projectName),
        vendorId: String(vendorID ?? ''),
        vendorCode: vendorCode ?? '',
        vendorName: vendorName ?? '',
        distanceFromUser: segmentDistanceFromUser,
        pitLocationId: pit.pitId ?? null,
        pitNo: pit.pitNo,
        loopData: loopData,
        sldeReportData: pit,
        CurrentChamberInstallationId: currentChamberId,
        fromChamberInstallationId: fromChamberInstallationId,
        toChamberInstallationId: toChamberInstallationId,
        ductNo: selectedDuctRef.current?.ductNo ?? 0,
        vendorStoreId: pit?.vendorStoreId ?? 0,
        fibreTypeId: pit?.fiberTypeId ?? 0,
        fiberType: pit?.fiberType ?? '',
        pitType: pit?.pitType || pit?.itemName || '',
        pitId: pit?.pitId ?? 0,
      });
    },
    [
      navigation,
      projectId,
      projectCode,
      projectName,
      vendorID,
      vendorCode,
      vendorName,
    ],
  );
  // ─────────────────────────────────────────────────────────────────────────
  // isPitClickable — same as before, uses clickablePitIds set
  // ─────────────────────────────────────────────────────────────────────────
  const isPitClickable = useCallback(
    (_index: number, cardId: string, pit: PitItem): boolean => {
      const isOpen = clickablePitIds.has(pit.pitLocationId);
      if (!isOpen) return false;
      const distToPit = pitDistancesRef.current[cardId];
      if (distToPit === undefined) return false;
      return distToPit <= CLICKABLE_RANGE_M;
      // return true; // for testing
    },
    [clickablePitIds],
  );
  const nearestIndex =
    pitList && nearestPitId
      ? pitList.findIndex(
          item =>
            String(item?.pitLocationId ?? item?.pitNo ?? '') === nearestPitId,
        )
      : -1;
  const activeHereCardId: string | null = (() => {
    if (!pitList || pitList.length === 0) return null;
    if (nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M) return null;
    return nearestPitId;
  })();
  useEffect(() => {
    if (!pitList?.length) return;

    const timer = setTimeout(() => {
      const y = getAccuratePinTop();

      if (y >= 0) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 10),
          animated: true,
        });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    activeBetweenIndex,
    userAtLastPit,
    nearestPitId,
    cardHeights,
    betweenRowHeights,
    pitList,
  ]);
  const isUserFar = nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M;

  const getAccuratePinTop = (): number => {
    if (!pitList || pitList.length === 0) return -999;
    const topBeforeCard = (targetIdx: number): number => {
      let top = 0;
      for (let i = 0; i < targetIdx; i++) {
        const id = String(pitList[i]?.pitLocationId ?? pitList[i]?.pitNo ?? i);
        top += (cardHeights[id] ?? 110) + CARD_GAP;
        top += (betweenRowHeights[i] ?? BETWEEN_ROW_H) + CARD_GAP;
      }
      return top;
    };
    const cardCenterTop = (targetIdx: number): number => {
      const top = topBeforeCard(targetIdx);
      const selId = String(
        pitList[targetIdx]?.pitLocationId ??
          pitList[targetIdx]?.pitNo ??
          targetIdx,
      );
      return top + (cardHeights[selId] ?? 110) / 2 - PIN_SIZE / 2;
    };
    const betweenRowCenterTop = (segIdx: number): number => {
      const topAfterCard =
        topBeforeCard(segIdx) +
        (cardHeights[
          String(
            pitList[segIdx]?.pitLocationId ?? pitList[segIdx]?.pitNo ?? segIdx,
          )
        ] ?? 110) +
        CARD_GAP;
      const bh =
        segIdx === activeBetweenIndex
          ? BETWEEN_ROW_H_ACTIVE
          : betweenRowHeights[segIdx] ?? BETWEEN_ROW_H;
      return topAfterCard + bh / 2 - PIN_SIZE / 2;
    };
    if (nearestPitDistM <= YOU_ARE_HERE_THRESHOLD_M && nearestIndex >= 0)
      return cardCenterTop(nearestIndex);
    if (activeBetweenIndex >= 0 && nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M)
      return betweenRowCenterTop(activeBetweenIndex);
    if (nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M && nearestIndex >= 0)
      return cardCenterTop(nearestIndex);
    return -999;
  };

  const pinTop = getAccuratePinTop();
  const hasPits = pitList.length > 0;
  const shouldShowPin =
    hasPits &&
    !isOutOfProject &&
    pinVisible &&
    ((!isUserFar && nearestIndex >= 0) || isUserFar) &&
    pinTop >= -500 &&
    userCoords !== null;
  const pinAnimation = activeHereCardId !== null ? 'pulse' : 'rubberBand';
  const pinDuration = activeHereCardId !== null ? 1000 : 1500;

  const activePitLocationId = React.useMemo<number | null>(() => {
    const found = pitList.find(
      p =>
        p.isShotOpen === true || p.isOpenForShot === true || p.isOpen === true,
    );
    return found?.pitLocationId ?? null;
  }, [pitList]);
  const showBetweenDistances =
    activeBetweenIndex >= 0 &&
    betweenPrevDistance !== null &&
    betweenNextDistance !== null;
  const totalPits = pitList.length;
  const pendingShots = pitList.filter(p => !isPitBlown(p.blowingStatus)).length;

  const totalRouteDistanceLabel = React.useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';
    let totalMeters = 0;
    for (let i = 0; i < pitList.length - 1; i++) {
      const lat1 = parseFloat(pitList[i]?.lat ?? '0');
      const lng1 = parseFloat(pitList[i]?.lon ?? '0');
      const lat2 = parseFloat(pitList[i + 1]?.lat ?? '0');
      const lng2 = parseFloat(pitList[i + 1]?.lon ?? '0');
      if (
        !isNaN(lat1) &&
        !isNaN(lng1) &&
        !isNaN(lat2) &&
        !isNaN(lng2) &&
        !(lat1 === 0 && lng1 === 0) &&
        !(lat2 === 0 && lng2 === 0)
      )
        totalMeters += haversineDistance(lat1, lng1, lat2, lng2);
    }
    return formatDistance(totalMeters);
  }, [pitList]);

  const segmentDistLabels = React.useMemo<string[]>(() => {
    if (!pitList || pitList.length < 2) return [];
    return pitList.slice(0, -1).map((_, i) => {
      const lat1 = parseFloat(pitList[i]?.lat ?? '0');
      const lng1 = parseFloat(pitList[i]?.lon ?? '0');
      const lat2 = parseFloat(pitList[i + 1]?.lat ?? '0');
      const lng2 = parseFloat(pitList[i + 1]?.lon ?? '0');
      if (
        isNaN(lat1) ||
        isNaN(lng1) ||
        isNaN(lat2) ||
        isNaN(lng2) ||
        (lat1 === 0 && lng1 === 0) ||
        (lat2 === 0 && lng2 === 0)
      )
        return '';
      return formatDistance(haversineDistance(lat1, lng1, lat2, lng2));
    });
  }, [pitList]);

  const handleLayout = (id: string, h: number) =>
    setCardHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));
  const handleBetweenLayout = (idx: number, h: number) =>
    setBetweenRowHeights(prev =>
      prev[idx] === h ? prev : {...prev, [idx]: h},
    );

  return (
    <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={styles.body}>
        <View style={styles.main}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation?.goBack()}
              style={styles.backWrap}>
              <Image
                style={styles.backIcon}
                source={IMAGES.arrowBack}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <Text style={styles.title}>Fiber Blowing</Text>
            <View style={styles.backWrap} />
          </View>
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Duct Picker Row */}
            <View style={styles.colorPickerCard}>
              <Text style={styles.colorPickerLabel}>Duct No.</Text>
              {colorLoading ? (
                <View style={styles.colorPickerLoading}>
                  <ActivityIndicator size={14} color={COLORS.PRIMARY} />
                  <Text style={styles.colorPickerLoadingText}>
                    Loading colors…
                  </Text>
                </View>
              ) : (
                <View style={styles.colorPickerRow}>
                  <View style={styles.colorPickerFlex}>
                    <DssCustomPicker
                      data={ductList}
                      value={selectedDuct}
                      placeholder="Select Duct No..."
                      onSelect={handleDuctSelect}
                      labelKey="ductNo"
                      renderItem={(item: DuctItem) => (
                        <Text>Duct {item.ductNo}</Text>
                      )}
                      renderSelectedItem={(item: DuctItem) => (
                        <Text>Duct {item.ductNo}</Text>
                      )}
                    />
                  </View>
                </View>
              )}
            </View>

            {userCoords && (
              <View style={styles.liveGpsBanner}>
                <Animatable.View
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1800}
                  style={styles.liveGpsDot}
                />
                <Text
                  style={
                    styles.liveGpsText
                  }>{`Live GPS  •  Lat: ${userCoords.latitude}°  Long: ${userCoords.longitude}°`}</Text>
              </View>
            )}
            <Text
              style={{
                fontSize: SIZE.MS(10),
                color: COLORS.BLACK,
                fontFamily: FONTS.BOLD,
              }}>
              Project StartPoint:{' '}
              <Text style={{color: COLORS.SUCCESS, fontFamily: FONTS.BOLD}}>
                {startPoint}
              </Text>
              {'\n'}
              Project EndPoint:{'  '}
              <Text style={{color: COLORS.ERROR, fontFamily: FONTS.BOLD}}>
                {endPoint}
              </Text>
            </Text>
            <ActivePitBadge
              activePitLocationId={activePitLocationId}
              isLoading={activePitLoading}
            />

            {activeHereCardId && hasPits ? (
              <Animatable.View
                key={`banner-here-${activeHereCardId}`}
                animation="fadeInDown"
                duration={400}
                style={styles.nearestBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1000}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.bannerText}>
                  📍 You are Nearest to —{' '}
                  <Text style={styles.bannerBold}>{nearestPitLabel}</Text>
                </Text>
              </Animatable.View>
            ) : activeBetweenIndex >= 0 && hasPits ? (
              <Animatable.View
                key={`banner-between-${activeBetweenIndex}`}
                animation="fadeInDown"
                duration={400}
                style={styles.betweenCorrBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1000}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.betweenCorrText}>
                  You are between{' '}
                  <Text style={styles.betweenCorrBold}>
                    PIT -{' '}
                    {displayPitNo(pitList[activeBetweenIndex]?.pitNo ?? '')} (
                    {betweenPrevDistance != null
                      ? `${formatDistance(betweenPrevDistance)} away`
                      : '-'}
                    ){' '}
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.betweenCorrBold}>
                    PIT -{' '}
                    {displayPitNo(pitList[activeBetweenIndex + 1]?.pitNo ?? '')}{' '}
                    (
                    {betweenNextDistance != null
                      ? `${formatDistance(betweenNextDistance)} away`
                      : '-'}
                    ){' '}
                  </Text>
                </Text>
              </Animatable.View>
            ) : userAtLastPit &&
              activeBetweenIndex === -1 &&
              nearestPitDistM > 30 &&
              distanceFromLastPit > 30 ? (
              <Animatable.View
                key="banner-away-last-pit"
                animation="fadeInDown"
                duration={400}
                style={styles.nearestBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1200}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.bannerText}>
                  You are{' '}
                  <Text style={styles.bannerBold}>
                    {formatDistance(distanceFromLastPit)}
                  </Text>{' '}
                  away from last pit
                </Text>
              </Animatable.View>
            ) : pinVisible && nearestPitLabel !== '' ? (
              <Animatable.View
                key="banner-nearest"
                animation="fadeInDown"
                duration={400}
                style={styles.nearestBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1400}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.bannerText}>
                  You are nearest to:{' '}
                  <Text style={styles.bannerBold}>{nearestPitLabel}</Text>
                </Text>
              </Animatable.View>
            ) : null}

            {/* Project card */}
            <View style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <Image
                  style={styles.projectIcon}
                  source={IMAGES.hddiconImg}
                  resizeMode="contain"
                />
                <View style={styles.projectMeta}>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>PROJ-CODE: </Text>
                    <Text style={styles.metaValue}>{projectCode}</Text>
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>PROJ-NAME: </Text>
                    <Text style={styles.metaValue}>{projectName}</Text>
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>Vendor Code/Name: </Text>
                    <Text style={styles.metaValue}>
                      {vendorCode}/{vendorName}
                    </Text>
                  </Text>
                </View>
              </View>
              <View style={styles.routeRow}>
                <View style={styles.routeBox}>
                  <View
                    style={[styles.routeBadge, {backgroundColor: '#3EC21E'}]}>
                    <Text style={styles.routeBadgeText}>SP</Text>
                  </View>
                  <Text style={styles.routeAddress} numberOfLines={1}>
                    {spRoute}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openMapDirections(startPoint, 'Start Point')}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  activeOpacity={0.75}>
                  <Image source={IMAGES.buttonIcon} style={styles.btnIcon} />
                </TouchableOpacity>{' '}
              </View>
              <ShortDashedConnector />
              <View style={styles.routeRow}>
                <View style={styles.routeBox}>
                  <View
                    style={[
                      styles.routeBadge,
                      {backgroundColor: COLORS.ERROR},
                    ]}>
                    <Text style={styles.routeBadgeText}>EP</Text>
                  </View>
                  <Text style={styles.routeAddress} numberOfLines={1}>
                    {epRoute}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openMapDirections(endPoint, 'End Point')}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  activeOpacity={0.75}>
                  <Image source={IMAGES.buttonIcon} style={styles.btnIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Total Distance:{totalRouteDistanceLabel}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Total No. of Pits:{totalPits}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Pending Distance:{pendingDistanceLabel || '-'}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Pending Shots: {pendingShots}
                </Text>
              </View>
            </View>

            {/* Pit list */}
            {!selectedDuct && !colorLoading ? (
              <View style={styles.selectColorPlaceholder}>
                <Text style={styles.selectColorPlaceholderEmoji}>🎨</Text>
                <Text style={styles.selectColorPlaceholderText}>
                  Select a duct color above to view pits
                </Text>
              </View>
            ) : isLoading ? (
              <View style={styles.loaderContainer}>
                <Animatable.View
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1000}>
                  <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                </Animatable.View>
                <Text style={styles.loaderText}>Loading pits…</Text>
                {[0, 1, 2].map(i => (
                  <Animatable.View
                    key={i}
                    animation="pulse"
                    iterationCount="infinite"
                    duration={1200 + i * 200}
                    style={styles.skeletonCard}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.pitListContainer}>
                {hasPits && (
                  <View style={styles.dashLineCol} pointerEvents="none">
                    <VerticalDashedLineAutoHeight
                      left={DASH_COL_WIDTH / 2 - DASH_W / 2}
                      color={COLORS.colorDimgray ?? '#888'}
                      opacity={0.5}
                      onHeightMeasured={h => {
                        if (h > 0 && h !== dashColHeight) setDashColHeight(h);
                      }}
                    />
                    {showBetweenDistances && (
                      <Animatable.Image
                        ref={pinAnimRef}
                        source={IMAGES.locationCheck}
                        animation={pinAnimation}
                        iterationCount="infinite"
                        duration={pinDuration}
                        useNativeDriver
                        style={[
                          styles.nearestPinIcon,
                          {
                            top: pinTop,
                            marginTop: 5,
                            left: DASH_COL_WIDTH / 2 - PIN_SIZE / 2,
                            position: 'absolute',
                          },
                        ]}
                        resizeMode="contain"
                      />
                    )}
                    {activeBetweenIndex >= 0 &&
                      betweenPrevDistance !== null &&
                      betweenNextDistance !== null && (
                        <>
                          <View
                            style={[
                              styles.betweenArrowWrap,
                              {top: pinTop - 46},
                            ]}>
                            <Text style={styles.betweenArrowSymbol}>↑</Text>
                            <Text style={styles.betweenArrowLabel}>
                              {formatDistance(betweenPrevDistance)}
                              away{'\n'}
                              from
                              {displayPitNo(
                                pitList[activeBetweenIndex]?.pitNo ?? '',
                              )}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.betweenArrowWrap,
                              {top: pinTop + PIN_SIZE + 4},
                            ]}>
                            <Text style={styles.betweenArrowSymbol}>↓</Text>
                            <Text style={styles.betweenArrowLabel}>
                              {formatDistance(betweenNextDistance)}
                              {'\n'}away{'\n'}
                              from
                              {displayPitNo(
                                pitList[activeBetweenIndex + 1]?.pitNo ?? '',
                              )}
                            </Text>
                          </View>
                        </>
                      )}
                    {/* //uncomment later */}
                    {userAtLastPit &&
                      activeBetweenIndex === -1 &&
                      nearestPitDistM > 30 &&
                      distanceFromLastPit > 30 && (
                        <View
                          style={[
                            styles.awayLabelWrap,
                            {top: pinTop + PIN_SIZE + 2, marginTop: -60},
                          ]}>
                          <Animatable.Image
                            source={IMAGES.locationCheck}
                            animation="pulse"
                            iterationCount="infinite"
                            duration={1200}
                            style={styles.awayLabelIcon}
                            resizeMode="contain"
                          />
                          <Text style={styles.awayLabelLine1}>
                            {nearestPitDistM < 1000
                              ? `${Math.round(nearestPitDistM)} m`
                              : `${(nearestPitDistM / 1000).toFixed(2)} km`}
                          </Text>
                          <Text style={styles.awayLabelLine2}>away from</Text>
                          <Text style={styles.awayLabelLine2}>last pit</Text>
                        </View>
                      )}
                  </View>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* 👇 ADD YOUR PIN BLOCK HERE — inside dashLineCol, at the end  */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {activeBetweenIndex < 0 &&
                  !userAtLastPit &&
                  nearestPitId &&
                  (() => {
                    const targetIndex = pitList.findIndex(
                      (item: any) =>
                        String(item?.pitLocationId ?? item?.pitNo ?? '') ===
                        nearestPitId,
                    );
                    if (targetIndex < 0) return null;
                    let topOffset = 0;
                    for (let i = 0; i < targetIndex; i++) {
                      const id = String(
                        pitList[i]?.pitLocationId ?? pitList[i]?.pitNo ?? i,
                      );
                      const cardH = cardHeights[id] ?? 110;
                      const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;
                      topOffset += cardH + CARD_GAP + betweenH + CARD_GAP;
                    }
                    const currentId = String(
                      pitList[targetIndex]?.pitLocationId ??
                        pitList[targetIndex]?.pitNo ??
                        targetIndex,
                    );
                    const cardHeight = cardHeights[currentId] ?? 110;
                    const centerOffset = topOffset + cardHeight / 2 - 14;
                    return (
                      <View
                        style={{
                          position: 'absolute',
                          top: centerOffset,
                          left: DASH_COL_WIDTH / 2 - 14, // Changed: center the 28px image on the dashed line
                          width: 28,
                          alignItems: 'center',
                          zIndex: 999,
                        }}>
                        <Animatable.Image
                          source={IMAGES.locationCheck}
                          animation="pulse"
                          iterationCount="infinite"
                          duration={1200}
                          style={{
                            width: 28,
                            height: 28,
                          }}
                          resizeMode="contain"
                        />
                        <Text
                          numberOfLines={3}
                          style={{
                            marginLeft: SIZE.MS(80),
                            marginTop: 4,
                            fontSize: 10,
                            color: COLORS.BLACK,
                            fontFamily: FONTS.BOLD,
                            width: 120,
                          }}>
                          {nearestPitLabel2.split('\n').join('\n')}
                        </Text>
                      </View>
                    );
                  })()}
                <View style={styles.pitListRight}>
                  {hasPits ? (
                    pitList.map((pit, index) => {
                      const cardId = String(
                        pit?.pitLocationId ?? pit?.pitNo ?? index,
                      );
                      const isNearest =
                        !!activeHereCardId && cardId === activeHereCardId;
                      const isDone = isPitBlown(pit.blowingStatus);
                      const isBlowingStatus: string =
                        pit.blowingStatus ?? 'N/A';
                      const pitDisplayNoVal = displayPitNo(pit.pitNo);
                      const ItemName = pit?.itemName ?? '-';
                      const canClick = isPitClickable(index, cardId, pit);
                      const distToThisPit = pitDistances[cardId];
                      const distToThisPitLabel =
                        distToThisPit !== undefined
                          ? formatDistance(distToThisPit)
                          : pit.distance > 0
                          ? formatDistance(pit.distance)
                          : '';
                      const isDefaultCoupler = isDefaultCouplerPit(pit);

                      return (
                        <React.Fragment key={`${cardId}-${index}`}>
                          {index === 0 && startInsertIndex === -1 && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 10,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginVertical: 10,
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                  }}>
                                  {/* Left Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                  {/* Center Text */}
                                  <Text
                                    style={{
                                      color: COLORS.SUCCESS,
                                      fontWeight: '700',
                                      fontSize: 15,
                                      marginHorizontal: 10,
                                    }}>
                                    Project Start Point
                                  </Text>
                                  {/* Right Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                </View>
                              </View>
                            </View>
                          )}

                          {startInsertIndex === index && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 10,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginVertical: 10,
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                  }}>
                                  {/* Left Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                  {/* Center Text */}
                                  <Text
                                    style={{
                                      color: COLORS.SUCCESS,
                                      fontWeight: '700',
                                      fontSize: 15,
                                      marginHorizontal: 10,
                                    }}>
                                    Project Start Point
                                  </Text>
                                  {/* Right Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                </View>
                              </View>
                            </View>
                          )}
                          <ShotCard
                            pitId={`PIT - ${pitDisplayNoVal}`}
                            pitType={pit?.pitType ?? 'N/A'}
                            shotStatus={isBlowingStatus}
                            gpsAddress={pit.pitAddress?.trim() ?? ''}
                            itemName={ItemName}
                            distanceLabel={distToThisPitLabel}
                            isPending={!isDone}
                            isNearest={isNearest}
                            landmark={pit.pitLandmark?.trim() ?? '-'}
                            lat={`${pit.lat ?? '0'}°`}
                            long={`${pit.lon ?? '0'}°`}
                            pic1Url={pit.pic1Url ?? null}
                            pic2Url={pit.pic2Url ?? null}
                            isClickable={canClick}
                            isDefaultCoupler={isDefaultCoupler}
                            onLayout={h => handleLayout(cardId, h)}
                            onViewImages={() =>
                              setGalleryData({
                                pitId: `PIT - ${pitDisplayNoVal}`,
                                pic1Url: pit.pic1Url ?? null,
                                pic2Url: pit.pic2Url ?? null,
                              })
                            }
                            onViewOnMap={() =>
                              handleViewOnMap(
                                pit?.lat,
                                pit?.lon,
                                pitDisplayNoVal,
                              )
                            }
                            onPress={() => handlePitPress(pit, index)}
                            onAddDefaultCoupler={() =>
                              handleOpenDefaultCouplerModal(pit, index)
                            }
                          />
                          {endInsertIndex === index &&
                            index !== pitList.length - 1 && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginTop: 10,
                                  width: '100%',
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`left-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                                {/* Center Text */}
                                <Text
                                  style={{
                                    color: COLORS.ERROR,
                                    fontWeight: '700',
                                    fontSize: 15,
                                    marginHorizontal: 10,
                                  }}>
                                  Project End Point
                                </Text>

                                {/* Right Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`right-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                              </View>
                            )}

                          {index === pitList.length - 1 &&
                            endInsertIndex === pitList.length - 1 && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginTop: 10,
                                  width: '100%',
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`left-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                                {/* Center Text */}
                                <Text
                                  style={{
                                    color: COLORS.ERROR,
                                    fontWeight: '700',
                                    fontSize: 15,
                                    marginHorizontal: 10,
                                  }}>
                                  Project End Point
                                </Text>

                                {/* Right Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`right-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                              </View>
                            )}
                          {/* ── Between-row gap ── */}
                          {index < pitList.length - 1 && (
                            <View
                              style={[
                                styles.betweenRow,
                                isDefaultCoupler &&
                                  styles.betweenRowDefaultCoupler,
                              ]}
                              onLayout={e =>
                                handleBetweenLayout(
                                  index,
                                  e.nativeEvent.layout.height,
                                )
                              }>
                              <View style={styles.betweenPillRow}>
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                  }}>
                                  {segmentDistLabels[index] ? (
                                    <View style={styles.betweenDistPill}>
                                      <Text style={styles.betweenDistArrow}>
                                        ↕
                                      </Text>
                                      <Text style={styles.betweenDistText}>
                                        {segmentDistLabels[index]}
                                      </Text>
                                    </View>
                                  ) : null}

                                  {activeBetweenIndex === index && (
                                    <View style={styles.betweenHerePill}>
                                      <Text style={styles.betweenHereText}>
                                        📍 You are here
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : selectedDuct ? (
                    <View style={styles.noPitsWrap}>
                      <Image
                        source={IMAGES.noImage}
                        style={styles.noDataIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.noDataText}>No Data Found</Text>
                    </View>
                  ) : null}
                  {userAtLastPit && activeBetweenIndex < 0 && (
                    <View
                      style={{
                        alignItems: 'center',
                        flexDirection: 'column',
                        left: -100,
                        bottom: 40, // adjust as needed
                        position: 'absolute',
                        marginTop: 80,
                      }}>
                      <Animatable.Image
                        source={IMAGES.locationCheck}
                        animation="rubberBand"
                        iterationCount="infinite"
                        duration={1200}
                        style={{width: 28, height: 28}}
                        resizeMode="contain"
                      />

                      <View
                        style={{
                          marginTop: 8,
                          width: 150,
                          alignItems: 'center',
                        }}>
                        <Text
                          style={{
                            fontSize: SIZE.MS(9),
                            color: COLORS.BLACK,
                            fontFamily: FONTS.BOLD,
                            textAlign: 'center',
                          }}>
                          You are at{'\n'}last PIT
                        </Text>

                        <Text
                          style={{
                            marginTop: 2,
                            fontSize: SIZE.MS(9),
                            color: COLORS.BLACK,
                            fontFamily: FONTS.BOLD,
                            textAlign: 'center',
                          }}>
                          {isPastProjectEnd &&
                            `You are ${
                              distanceFromProjectEnd < 1000
                                ? `${Math.round(distanceFromProjectEnd)}m`
                                : `${(distanceFromProjectEnd / 1000).toFixed(
                                    2,
                                  )}\nkm`
                            }`}
                        </Text>

                        <Text
                          style={{
                            fontSize: SIZE.MS(9),
                            color: COLORS.BLACK,
                            fontFamily: FONTS.BOLD,
                            textAlign: 'center',
                          }}>
                          {isPastProjectEnd
                            ? 'Project End\nPoint'
                            : 'away from\nEnd Point'}
                        </Text>
                      </View>
                    </View>
                  )}
                  {userAtLastPit &&
                    distanceFromProjectEnd > 1 &&
                    // This condition ensures second section only shows when first section is not active
                    !(userAtLastPit && activeBetweenIndex < 0) &&
                    (() => {
                      const totalHeight = pitList.reduce((acc, item, i) => {
                        const id = String(
                          item?.pitLocationId ?? item?.pitNo ?? i,
                        );
                        const cardH = cardHeights[id] ?? 110;
                        const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;
                        return acc + cardH + CARD_GAP + betweenH + CARD_GAP;
                      }, 0);
                      const bottomOffset = totalHeight - 40;
                      return (
                        <View style={{marginBottom: SIZE.MS(20)}}>
                          <Animatable.Image
                            source={IMAGES.locationCheck}
                            animation="pulse"
                            iterationCount="infinite"
                            duration={1200}
                            style={{width: 28, height: 28}}
                            resizeMode="contain"
                          />
                          <Text
                            style={{
                              marginLeft: SIZE.MS(-10),
                              fontSize: SIZE.MS(9),
                              color: COLORS.BLACK,
                              marginTop: 4,
                              fontFamily: FONTS.BOLD,
                            }}>
                            {isPastProjectEnd
                              ? `You are \n${formatDistance(
                                  distanceFromProjectEnd,
                                )}\n from \nEnd Point`
                              : `You are ${formatDistance(
                                  distanceFromProjectEnd,
                                )}\n from\nEnd Point`}
                          </Text>
                        </View>
                      );
                    })()}
                  {userAtLastPit &&
                    distanceFromProjectEnd > 1 &&
                    (() => {
                      const totalHeight = pitList.reduce((acc, item, i) => {
                        const id = String(
                          item?.pitLocationId ?? item?.pitNo ?? i,
                        );
                        const cardH = cardHeights[id] ?? 110;
                        const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;
                        return acc + cardH + CARD_GAP + betweenH + CARD_GAP;
                      }, 0);

                      const lastPitBannerAlsoShowing =
                        userAtLastPit &&
                        activeBetweenIndex === -1 &&
                        nearestPitDistM > 5 &&
                        distanceFromLastPit > 5;

                      const bottomOffset =
                        totalHeight - 40 + (lastPitBannerAlsoShowing ? 46 : 0);

                      return (
                        <View
                          style={{
                            // position: 'absolute',
                            flexDirection: 'row',
                            // bottom: 60,
                            // top: bottomOffset,
                            marginTop: SIZE.MS(12),
                            // left: 40,
                            // right: 0,
                            marginLeft: SIZE.MS(60),
                            marginRight: SIZE.MS(20),
                            alignItems: 'center',
                          }}>
                          <Animatable.Image
                            source={IMAGES.locationCheck}
                            animation="pulse"
                            iterationCount="infinite"
                            duration={1200}
                            style={{width: 28, height: 28}}
                            resizeMode="contain"
                          />
                          <Text
                            style={{
                              marginLeft: SIZE.MS(6),
                              fontSize: 10,
                              color: COLORS.BLACK,
                              fontFamily: FONTS.BOLD,
                              flexShrink: 1,
                            }}>
                            {isPastProjectEnd
                              ? `You are ${formatDistance(
                                  distanceFromProjectEnd,
                                )}\n from Project End Point`
                              : `You are ${formatDistance(
                                  distanceFromProjectEnd,
                                )} away from Project End Point`}
                          </Text>
                        </View>
                      );
                    })()}

                  {userAtLastPit &&
                    activeBetweenIndex === -1 &&
                    nearestPitDistM > 5 &&
                    distanceFromLastPit > 5 && (
                      <View
                        style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Animatable.Image
                          source={IMAGES.locationCheck}
                          animation="pulse"
                          iterationCount="infinite"
                          duration={1200}
                          style={{width: 28, height: 28}}
                          resizeMode="contain"
                        />
                        <Text style={styles.distanceFromLastPitValue}>
                          You are{' '}
                          {nearestPitDistM < 1000
                            ? `${Math.round(nearestPitDistM)} m`
                            : `${(nearestPitDistM / 1000).toFixed(2)} km`}{' '}
                          away from your last Pit
                        </Text>
                      </View>
                    )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
        <TouchableOpacity
          style={[
            styles.whereAreYouBar,
            (locLoading || isLoading) && styles.whereAreYouBarLoading,
          ]}
          activeOpacity={0.85}
          disabled={locLoading || isLoading}
          onPress={handleWhereAmI}>
          {locLoading || isLoading ? (
            <View style={styles.whereAmIRow}>
              <ActivityIndicator size={16} color={COLORS.colorWhite} />
              <Text style={styles.whereAreYouText}>
                {isLoading ? 'Loading pits…' : 'Getting location…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.whereAreYouText}>Where I am?</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Gallery Modal ── */}
      <Modal
        visible={galleryData !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setGalleryData(null)}>
        <TouchableWithoutFeedback onPress={() => setGalleryData(null)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.modalContainer}>
                <View style={modalStyles.modalHeader}>
                  <Text style={modalStyles.modalTitle}>
                    {galleryData?.pitId ?? 'PIT Images'}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
                    onPress={() => setGalleryData(null)}>
                    <Text style={modalStyles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={modalStyles.scrollBody}>
                  {(['pic1Url', 'pic2Url'] as const).map((key, idx) => {
                    const url = galleryData?.[key];
                    return (
                      <View key={key} style={modalStyles.imgBlock}>
                        <Text style={modalStyles.imgLabel}>
                          Image {idx + 1}
                        </Text>
                        {url ? (
                          <Image
                            style={modalStyles.pitStyling}
                            source={{uri: url}}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={modalStyles.noImgBox}>
                            <Image
                              source={IMAGES.galleryIcon}
                              style={modalStyles.noImgIcon}
                              resizeMode="contain"
                            />
                            <Text style={modalStyles.noImgText}>
                              No image available
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setGalleryData(null)}
                  style={modalStyles.imageButton}>
                  <Text style={modalStyles.closeTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Default Coupler Installation Modal (Full Form) ── */}
      <Modal
        visible={pitTypeModal.visible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          if (!pitTypeModal.pit) {
            setPitTypeModal({visible: false, pit: null, pitIndex: -1});
            return;
          }
          Alert.alert(
            'Discard Changes?',
            'Are you sure you want to close without saving?',
            [
              {text: 'Stay', style: 'cancel'},
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () =>
                  setPitTypeModal({visible: false, pit: null, pitIndex: -1}),
              },
            ],
          );
        }}>
        <View style={dcModalStyles.container}>
          {pitTypeModal.pit && (
            <DefaultCouplerInstallationForm
              pit={pitTypeModal.pit}
              pitIndex={pitTypeModal.pitIndex}
              projectId={projectId}
              projectCode={projectCode}
              projectName={projectName}
              vendorID={vendorID}
              vendorCode={vendorCode}
              vendorName={vendorName}
              selectedDuctNo={selectedDuctRef.current?.ductNo ?? 0}
              dispatch={dispatch}
              onClose={() => {
                Alert.alert(
                  'Discard Changes?',
                  'Are you sure you want to close without saving?',
                  [
                    {text: 'Stay', style: 'cancel'},
                    {
                      text: 'Discard',
                      style: 'destructive',
                      onPress: () =>
                        setPitTypeModal({
                          visible: false,
                          pit: null,
                          pitIndex: -1,
                        }),
                    },
                  ],
                );
              }}
              onSuccess={() => {
                setPitTypeModal({visible: false, pit: null, pitIndex: -1});
                if (selectedDuctRef.current)
                  fetchPitList(selectedDuctRef.current.ductNo);
              }}
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
};

// ── ShotCard ──────────────────────────────────────────────────────────────────
type ShotCardProps = {
  pitId: string;
  pitType?: string;
  fromToLabel?: string | null;
  shotStatus: string;
  gpsAddress: string;
  statusBgColor?: string;
  itemName: string;
  isPending: boolean;
  isNearest: boolean;
  isClickable: boolean;
  isDefaultCoupler?: boolean;
  landmark: string;
  lat: string;
  long: string;
  pic1Url: string | null;
  pic2Url: string | null;
  distanceLabel?: string;
  onLayout: (h: number) => void;
  onViewImages: () => void;
  onViewOnMap: () => void;
  onPress: () => void;
  onAddDefaultCoupler?: () => void;
};

const ShotCard: FC<ShotCardProps> = ({
  pitId,
  pitType,
  fromToLabel,
  shotStatus,
  gpsAddress,
  statusBgColor,
  isPending,
  isNearest,
  isClickable,
  isDefaultCoupler,
  landmark,
  lat,
  long,
  pic1Url,
  pic2Url,
  distanceLabel,
  onLayout,
  itemName,
  onViewImages,
  onViewOnMap,
  onPress,
  onAddDefaultCoupler,
}) => {
  const hasImages = !!(pic1Url || pic2Url);
  const handleCtaPress = () => {
    if (!isClickable) {
      Alert.alert(
        'Not Available',
        'This chamber is not available for Fiber Blowing yet.\n\nPlease complete the adjacent chamber first.',
        [{text: 'OK'}],
      );
      return;
    }
    onPress();
  };
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.height)}
      style={[
        shotCardStyles.card,
        isNearest && shotCardStyles.cardNearest,
        !isClickable && shotCardStyles.cardLocked,
        isDefaultCoupler && shotCardStyles.defaultCouplerCard,
        {
          backgroundColor: isDefaultCoupler
            ? '#ed8179'
            : isPending
            ? COLORS.colorWhite
            : '#D4DBDE',
        },
      ]}>
      <View style={shotCardStyles.headerRow}>
        <View style={shotCardStyles.pitBadgeWrap}>
          <View
            style={[
              shotCardStyles.pitBadge,
              {
                backgroundColor: isNearest
                  ? COLORS.SUCCESS ?? '#3EC21E'
                  : COLORS.PRIMARY,
              },
            ]}>
            <Text style={shotCardStyles.pitBadgeText}>{pitId}</Text>
          </View>
          {isClickable && (
            <Animatable.Image
              source={IMAGES.locationCheck}
              animation="pulse"
              iterationCount="infinite"
              duration={1200}
              style={shotCardStyles.pitOpenIcon}
              resizeMode="contain"
            />
          )}
        </View>
        <View style={shotCardStyles.statusGroup}>
          <Text style={styles.pitBadge2}>TYPE :</Text>
          <Animatable.View
            animation={(() => {
              const pitTypeValue = String(pitType || itemName || '')
                .trim()
                .toLowerCase();
              return pitTypeValue.includes('defaultcoupler') ||
                pitTypeValue.includes('default coupler')
                ? 'pulse'
                : undefined;
            })()}
            iterationCount="infinite"
            duration={1200}
            style={[
              shotCardStyles.statusBadge,
              {
                backgroundColor:
                  statusBgColor ??
                  (() => {
                    const pitTypeValue = String(pitType || itemName || '')
                      .trim()
                      .toLowerCase();
                    return pitTypeValue.includes('defaultcoupler') ||
                      pitTypeValue.includes('default coupler')
                      ? 'red'
                      : COLORS.PRIMARY;
                  })(),
              },
            ]}>
            <Text
              style={[
                shotCardStyles.statusBadgeText,
                (() => {
                  const pitTypeValue = String(pitType || itemName || '')
                    .trim()
                    .toLowerCase();
                  return (
                    (pitTypeValue.includes('defaultcoupler') ||
                      pitTypeValue.includes('default coupler')) && {
                      fontSize: 11,
                    }
                  );
                })(),
              ]}
              numberOfLines={1}>
              {pitType || 'N/A'}
            </Text>
          </Animatable.View>
        </View>
        <View style={shotCardStyles.statusGroup}>
          {isDefaultCoupler ? (
            <Text style={[shotCardStyles.statusLabel, {fontSize: 12}]}>
              Blowing Status:
            </Text>
          ) : (
            <Text style={shotCardStyles.statusLabel}>Blowing Status:</Text>
          )}
          <View
            style={[
              shotCardStyles.statusBadge,
              {
                backgroundColor:
                  shotStatus?.toLowerCase() === 'installed'
                    ? '#3EC21E'
                    : shotStatus?.toLowerCase() === 'pending'
                    ? '#F59E0B'
                    : COLORS.PRIMARY,
              },
            ]}>
            <Text style={shotCardStyles.statusBadgeText} numberOfLines={1}>
              {shotStatus || 'N/A'}
            </Text>
          </View>
        </View>
      </View>
      {isNearest && (
        <Animatable.View
          animation="pulse"
          iterationCount="infinite"
          duration={1200}
          style={shotCardStyles.nearestTag}>
          <Image
            source={IMAGES.locationCheck}
            style={shotCardStyles.nearestTagIcon}
            resizeMode="contain"
          />
          <Text style={shotCardStyles.nearestTagText}>📍 You are here</Text>
        </Animatable.View>
      )}
      {!isClickable && (
        <View style={shotCardStyles.lockedTag}>
          <Text style={shotCardStyles.lockedTagText}>
            🔒 Complete adjacent chamber first
          </Text>
        </View>
      )}
      {isDefaultCoupler ? (
        <Text style={shotCardStyles.metaText}>
          <Text style={[shotCardStyles.metaLabel, {fontSize: 14}]}>
            Landmark:{' '}
          </Text>
          <Text
            style={[
              shotCardStyles.metaValue,
              {fontSize: 14, fontWeight: 'bold'},
            ]}>
            {landmark}
          </Text>
        </Text>
      ) : (
        <Text style={shotCardStyles.metaText}>
          <Text style={shotCardStyles.metaLabel}>Landmark: </Text>
          <Text style={shotCardStyles.metaValue}>{landmark}</Text>
        </Text>
      )}
      {gpsAddress ? (
        <View>
          {isDefaultCoupler ? (
            <Text
              style={[
                shotCardStyles.addressText,
                {fontSize: 14, fontWeight: 'bold'},
              ]}
              numberOfLines={2}>
              {gpsAddress}
            </Text>
          ) : (
            <Text style={shotCardStyles.addressText} numberOfLines={2}>
              {gpsAddress}
            </Text>
          )}
        </View>
      ) : null}
      <View style={shotCardStyles.bottomRow}>
        {isDefaultCoupler ? (
          <View style={shotCardStyles.latLongGroup}>
            <Text
              style={[
                shotCardStyles.latLongText,
                {fontSize: 12, fontWeight: 'bold'},
              ]}>
              Lat: {lat}
            </Text>
            <Text
              style={[
                shotCardStyles.latLongText,
                {fontSize: 12, fontWeight: 'bold'},
              ]}>
              Long: {long}
            </Text>
          </View>
        ) : (
          <View style={shotCardStyles.latLongGroup}>
            <Text style={shotCardStyles.latLongText}>Lat: {lat}</Text>
            <Text style={shotCardStyles.latLongText}>Long: {long}</Text>
          </View>
        )}
        <View style={{flexDirection: 'column', alignItems: 'center'}}>
          <TouchableOpacity
            style={styles.viewImagesRow}
            onPress={onViewOnMap}
            activeOpacity={0.7}>
            <Image source={IMAGES.buttonIcon} style={styles.destinationIcon} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewImagesRow,
              !hasImages && styles.viewImagesDisabled,
            ]}
            onPress={e => {
              e.stopPropagation?.();
              onViewImages();
            }}
            disabled={!hasImages}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.viewImagesText,
                !hasImages && styles.viewImagesTextDimmed,
              ]}>
              View Images
            </Text>
            <Image
              style={[styles.pitThumb, !hasImages && {opacity: 0.35}]}
              source={IMAGES.galleryIcon}
              resizeMode="contain"
            />
            {hasImages && (
              <View style={styles.imgCountBadge}>
                <Text style={styles.imgCountText}>
                  {pic1Url && pic2Url ? '2' : '1'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {/* CTA Button */}
      {isPending && (
        <TouchableOpacity
          activeOpacity={isClickable ? 0.8 : 1}
          style={[
            shotCardStyles.ctaBtn,
            !isClickable && shotCardStyles.ctaBtnLocked,
          ]}
          onPress={() => {
            if (!isClickable) {
              Alert.alert('You are Not In 20 meter range of that Pit');
              return;
            }
            handleCtaPress();
          }}>
          <Text style={shotCardStyles.ctaBtnText}>
            {isDefaultCoupler ? 'Click Images' : 'Click here to take photo'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
export default FiberBlowing;

// ── Default Coupler Modal container styles ────────────────────────────────────
const dcModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 0 : 44,
  },
});

// ── Gallery Modal Styles ──────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: FONTS.SEMI_BOLD,
  },
  closeBtn: {fontSize: 20, color: '#666', paddingHorizontal: 4},
  scrollBody: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 18,
  },
  imgBlock: {gap: 8},
  imgLabel: {
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#555',
  },
  pitStyling: {
    height: 210,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
  },
  noImgBox: {
    height: 120,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnIcon: {
    height: 30,
    width: 30,
    backgroundColor: '#e8f0fe',
    resizeMode: 'contain',
  },
  noImgIcon: {width: 28, height: 28, opacity: 0.3},
  noImgText: {fontSize: 13, color: '#aaa', fontFamily: FONTS.REGULAR},
  imageButton: {
    marginTop: 16,
    paddingVertical: 13,
    backgroundColor: '#535455',
    alignItems: 'center',
    borderRadius: 10,
  },
  closeTxt: {color: '#fff', fontFamily: FONTS.SEMI_BOLD, fontSize: 14},
});

// ── Main Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  imgCountBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  imgCountText: {
    fontSize: 9,
    color: COLORS.colorWhite,
    fontFamily: FONTS.SEMI_BOLD,
  },
  destinationIcon: {
    height: 30,
    width: 30,
    resizeMode: 'contain',
    alignSelf: 'flex-end',
  },
  viewImagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  pitThumb: {width: 17, height: 17},

  viewImagesDisabled: {opacity: 0.38},
  viewImagesText: {
    fontSize: FontSize.fs_10,
    color: COLORS.BLACK ?? '#6C63FF',
    fontFamily: FONTS.MEDIUM,
    textDecorationLine: 'underline',
  },
  viewImagesTextDimmed: {
    color: COLORS.colorDarkslategray,
    textDecorationLine: 'none',
  },
  distanceFromLastPitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF3E0',
    borderWidth: 1.5,
    borderColor: '#FF9800',
    borderRadius: Border.br_8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  btnIcon: {
    height: 30,
    width: 30,
    backgroundColor: '#e8f0fe',
    resizeMode: 'contain',
  },
  pitBadge2: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    marginLeft: 4,
  },
  distanceFromLastPitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE0B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceFromLastPitIconText: {fontSize: 18},
  distanceFromLastPitTextWrap: {flex: 1},
  distanceFromLastPitLabel: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
    color: '#E65100',
    marginBottom: 2,
  },
  distanceFromLastPitValue: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.BOLD,
    color: COLORS.BLACK,
    marginVertical: SIZE.MS(20),
  },
  body: {flex: 1, paddingTop: 16},
  main: {flex: 1, gap: 12},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Height.height_24,
    paddingHorizontal: 16,
  },
  backWrap: {width: 32},
  backIcon: {width: 24, height: 24},
  title: {
    fontSize: 18,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
    flex: 1,
  },
  scrollContent: {gap: 10, paddingBottom: 120, paddingHorizontal: 16},
  colorPickerCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 6,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  colorPickerLabel: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    marginBottom: 2,
  },
  colorPickerRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  colorPickerFlex: {flex: 1},
  colorPickerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  colorPickerLoadingText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  selectColorPlaceholder: {alignItems: 'center', paddingVertical: 36, gap: 8},
  selectColorPlaceholderEmoji: {fontSize: 38},
  selectColorPlaceholderText: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    opacity: 0.6,
    textAlign: 'center',
  },
  liveGpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: Border.br_8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  liveGpsText: {
    fontSize: FontSize.fs_11,
    color: '#1565C0',
    fontFamily: FONTS.MEDIUM,
    flexShrink: 1,
  },
  activePitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#66BB6A',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    marginTop: 2,
  },
  activePitBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  activePitBadgeLabel: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
    color: '#1B5E20',
  },
  activePitBadgeValue: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1B5E20',
  },
  activePitBadgeSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
    marginTop: 2,
  },
  activePitBadgeSkeletonText: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
    color: '#1565C0',
  },
  nearestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F9EE',
    borderWidth: 1,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerIcon: {width: 20, height: 20},
  bannerText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  bannerBold: {fontFamily: FONTS.SEMI_BOLD, color: COLORS.SUCCESS ?? '#3EC21E'},
  betweenCorrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 1.5,
    borderColor: '#1976D2',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  betweenCorrText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    color: '#0D47A1',
    fontFamily: FONTS.REGULAR,
  },
  betweenCorrBold: {fontFamily: FONTS.SEMI_BOLD, color: '#0D47A1'},
  projectCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    padding: Padding.padding_8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 6,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  projectHeader: {
    flexDirection: 'row',
    gap: Gap.gap_8,
    alignItems: 'flex-start',
  },
  projectIcon: {width: 36, height: 35, borderRadius: Border.br_6},
  projectMeta: {flex: 1, gap: 2},
  metaText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    textAlign: 'left',
  },
  metaLabel: {fontFamily: FONTS.SEMI_BOLD},
  metaValue: {fontFamily: FONTS.REGULAR},
  routeRow: {flexDirection: 'row', alignItems: 'center', gap: Gap.gap_4},
  routeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorGainsboro,
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_4,
    paddingVertical: Padding.padding_2,
    minHeight: 28,
    gap: Gap.gap_4,
    backgroundColor: COLORS.colorWhite,
  },
  betweenArrowWrap: {
    position: 'absolute',
    left: DASH_COL_WIDTH / 2 - 40,
    width: 80,
    alignItems: 'center',
    zIndex: 10,
  },
  betweenArrowSymbol: {
    fontSize: 25,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    // marginTop: 2,
    // backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 2,
  },
  betweenArrowLabel: {
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.BOLD,
    color: COLORS.BLACK,
    lineHeight: 11,
    marginLeft: -25,
    paddingLeft: SIZE.MS(20),
  },
  routeBadge: {
    width: Width.width_24,
    height: Height.height_24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeText: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.REGULAR,
  },
  routeAddress: {
    flex: 1,
    fontSize: FontSize.fs_10,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  mapPinIcon: {
    width: Width.width_28,
    height: Height.height_28,
    borderRadius: Border.br_8,
  },
  dashedWrap: {paddingLeft: 12, height: 8, justifyContent: 'center'},
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 10,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Gap.gap_3,
    backgroundColor: COLORS.colorGray ?? '#f5f5f5',
    borderRadius: Border.br_6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    flexShrink: 1,
  },
  statValueBox: {
    borderWidth: 1,
    borderColor: '#F7F6F6',
    borderRadius: Border.br_5,
    paddingHorizontal: Padding.padding_6,
    paddingVertical: 2,
    justifyContent: 'center',
    backgroundColor: COLORS.colorWhite,
  },
  statValue: {
    fontSize: 12,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  loaderContainer: {paddingVertical: 20, alignItems: 'center', gap: 12},
  loaderText: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  skeletonCard: {
    width: '100%',
    height: 100,
    borderRadius: Border.br_8,
    backgroundColor: '#E0E0E0',
  },
  pitListContainer: {flexDirection: 'row', alignItems: 'stretch'},
  dashLineCol: {
    width: DASH_COL_WIDTH,
    position: 'relative',
    marginRight: 6,
  },
  nearestPinIcon: {
    position: 'absolute',
    marginTop: 5,
    width: PIN_SIZE,
    height: PIN_SIZE,
    zIndex: 10,
  },
  awayLabelWrap: {
    position: 'absolute',
    left: DASH_COL_WIDTH / 2 - 36,
    width: 72,
    alignItems: 'center',
    zIndex: 10,
  },
  awayLabelIcon: {width: 20, height: 20, marginBottom: 2},
  awayLabelLine1: {
    fontSize: 11,
    color: COLORS.colorDarkslategray ?? '#555',
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    lineHeight: 14,
  },
  awayLabelLine2: {
    fontSize: 10,
    color: COLORS.BLACK ?? '#777',
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    lineHeight: 13,
  },
  pitListRight: {flex: 1, gap: 0},
  noPitsWrap: {alignItems: 'center', paddingVertical: 10},
  noDataIcon: {width: 125, height: 125, alignSelf: 'center'},
  noDataText: {
    fontSize: 15,
    color: COLORS.colorDarkslategray,
    opacity: 0.6,
    fontFamily: FONTS.REGULAR,
  },
  betweenRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: BETWEEN_ROW_H,
    marginVertical: 2,
    paddingVertical: 4,
    gap: 6,
  },
  betweenRowDefaultCoupler: {
    minHeight: BETWEEN_ROW_H_DEFAULT_COUPLER,
    paddingVertical: 10,
  },
  betweenPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  betweenDistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  betweenDistArrow: {
    fontSize: FontSize.fs_16,
    color: '#6B7280',
    fontFamily: FONTS.SEMI_BOLD,
  },
  betweenDistText: {
    fontSize: FontSize.fs_11,
    color: '#374151',
    fontFamily: FONTS.MEDIUM,
  },
  betweenHerePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F9EE',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#3EC21E',
  },
  betweenHereText: {
    fontSize: FontSize.fs_11,
    color: '#2E7D32',
    fontFamily: FONTS.SEMI_BOLD,
  },
  addDefaultCouplerBtn: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  addDefaultCouplerBtnIcon: {
    fontSize: 14,
    color: '#fff',
    fontFamily: FONTS.BOLD,
    lineHeight: 16,
  },
  addDefaultCouplerBtnText: {
    fontSize: 12,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#fff',
    letterSpacing: 0.2,
  },
  awayInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFC107',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  awayInlineIcon: {width: 22, height: 22},
  awayInlineTextWrap: {flex: 1},
  awayInlineDistText: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.BOLD,
    color: '#E65100',
  },
  awayInlineSubText: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
    color: '#795548',
    marginTop: 1,
  },
  whereAreYouBar: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Border.br_8,
    marginTop: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    width: '82%',
    alignSelf: 'center',
  },
  whereAreYouBarLoading: {backgroundColor: COLORS.colorDimgray ?? '#888'},
  whereAmIRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  whereAreYouText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorWhite,
  },
});

// ── ShotCard Styles ───────────────────────────────────────────────────────────
const shotCardStyles = StyleSheet.create({
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    backgroundColor: COLORS.colorWhite,
    marginBottom: 2,
  },
  defaultCouplerStatusBadge: {
    borderWidth: 1,
    borderColor: '#F57C00',
    paddingHorizontal: 10,
    minWidth: 120,
    alignItems: 'center',
    borderRadius: 14,
  },
  defaultCouplerStatusBadgeText: {
    color: COLORS.colorWhite,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 11,
  },
  defaultCouplerCard: {
    width: '94%',
    minHeight: 90,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 12,
    alignSelf: 'center',
  },
  cardNearest: {
    borderWidth: 2,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
    backgroundColor: '#F0FFF4',
  },
  cardLocked: {
    opacity: 0.72,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pitBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  pitBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pitBadgeText: {
    color: COLORS.colorWhite,
    fontSize: 10,
    fontFamily: FONTS.SEMI_BOLD,
  },
  pitOpenIcon: {
    width: 16,
    height: 16,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  statusLabel: {
    fontSize: 9,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    flexShrink: 0,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  statusBadgeText: {
    color: COLORS.colorWhite,
    fontSize: 9,
    fontFamily: FONTS.SEMI_BOLD,
    flexShrink: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    flexShrink: 0,
  },
  distanceBadgeText: {
    fontSize: 9,
    color: '#4338CA',
    fontFamily: FONTS.SEMI_BOLD,
  },
  nearestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#E6F9EE',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: '#3EC21E',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  nearestTagIcon: {width: 13, height: 13, tintColor: '#2E7D32'},
  nearestTagText: {fontSize: 10, color: '#2E7D32', fontFamily: FONTS.SEMI_BOLD},
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#F57C00',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  lockedTagText: {
    fontSize: 10,
    color: '#E65100',
    fontFamily: FONTS.SEMI_BOLD,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    paddingHorizontal: 8,
    paddingBottom: 2,
  },
  metaLabel: {
    fontFamily: FONTS.SEMI_BOLD,
  },
  metaValue: {
    fontFamily: FONTS.REGULAR,
  },
  addressText: {
    fontSize: 11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    lineHeight: 15,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 6,
  },
  latLongGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  latLongText: {
    fontSize: 10,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    letterSpacing: 0.2,
  },
  viewImagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  viewImagesBtnDisabled: {opacity: 0.38},
  viewImagesText: {
    fontSize: 10,
    color: COLORS.colorMediumslateblue ?? '#6C63FF',
    fontFamily: FONTS.MEDIUM,
    textDecorationLine: 'underline',
  },
  viewImagesTextDim: {
    color: COLORS.colorDarkslategray,
    textDecorationLine: 'none',
  },
  galleryIcon: {
    width: 17,
    height: 17,
  },
  imgCountBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  imgCountText: {
    fontSize: 9,
    color: COLORS.colorWhite,
    fontFamily: FONTS.SEMI_BOLD,
  },
  btnIcon: {
    height: 30,
    width: 30,
    backgroundColor: '#e8f0fe',
    resizeMode: 'contain',
  },
  ctaBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnLocked: {
    backgroundColor: '#9E9E9E',
  },
  ctaBtnText: {
    color: COLORS.colorWhite,
    fontSize: 12,
    fontFamily: FONTS.SEMI_BOLD,
    textDecorationLine: 'underline',
  },
});
