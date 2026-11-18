import React, {FC, useState, useEffect, useMemo, useRef} from 'react';
import {
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TouchableOpacity,
  TextInput,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import {useDispatch} from 'react-redux';
import {StoreDispatch} from '@reducers';
import {
  getMaintenanceActivityDDAPI,
  getMaintenanceActivityDetailsAPI,
} from '../../store/slices/maintenance.slice';
import {Common} from '@utils';
import {COLORS, IMAGES, SIZE, FONTS} from '@res';
import {useFocusEffect} from '@react-navigation/native';
import {
  Gap,
  FontFamily,
  FontSize,
  Border,
  Width,
  Height,
  BoxShadow,
  Padding,
} from '../../res/globalStyle';
import MapView, {Marker} from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';
import Geolocation from '@react-native-community/geolocation';
// Fallback lat/lng used until a real GPS fix comes in, so tab clicks call
const DEFAULT_COORDS = {lat: 28.54176799344652, lng: 77.25507331533792};
const MIN_RANGE = 50;
const RANGE_STEP = 50;
const SEARCH_DEBOUNCE_MS = 150;
// Live getMaintenanceActivityDetailsAPI is confirmed working now (thunk
const USE_STATIC_DATA = false;
// ── Activity Type item shape, as returned by getMaintenanceActivityDDAPI's
// `data.activityType` array — e.g. {id: 1, displayName: 'Cut', parentValueId: 0}
type ActivityTypeMaster = {
  id: number | string;
  displayName: string;
  parentValueId?: number | string;
  [key: string]: any;
};
type TabItem = {
  key: string;
  label: string;
  activityTypeId: number;
  filterType?: 'all' | 'api' | 'locating';
  locatingType?: 'OH' | 'UG';
};
const ALL_TAB: TabItem = {
  key: 'All',
  label: 'All',
  activityTypeId: 0,
  filterType: 'all',
};
const OH_TAB: TabItem = {
  key: 'OH',
  label: 'OH',
  activityTypeId: -1,
  filterType: 'locating',
  locatingType: 'OH',
};
const UG_TAB: TabItem = {
  key: 'UG',
  label: 'UG',
  activityTypeId: -2,
  filterType: 'locating',
  locatingType: 'UG',
};
interface AlertCardData {
  id: string;
  badgeLabel: string;
  badgeStyle: 'primary' | 'secondary';
  alertId: string;
  type: string;
  eventStartDate: string;
  status: string;
  priority: string;
  vendorName: string;
  vendorMobile: string;
  workBy: string;
  workingFor: string;
  companyType: string;
  latLong: string;
  address: string;
  landmark: string;
  gigId: string;
  leftChamber: string;
  rightChamber: string;
  latNum: number | null;
  lngNum: number | null;
  // NOTE: raw cutAlertLocatingType string ("Underground" / "Aerial" etc.) kept
  // alongside the already-derived badgeLabel, so screens navigated to from
  // here (e.g. AddCutScreen) can receive the real locating type value
  // instead of just the 2-letter badge.
  cutAlertLocatingType: string;
  cutAlertLocatingTypeId: number | null;
  activityStatusId: number | string | null; // NEW
}
// ── Maps a raw item from getMaintenanceActivityDetailsAPI's response into
// the shape AlertCard needs. Field names below now match the actual API
// contract confirmed from the curl response, e.g.:
// {
//   id, activityCode, activityTypeId, activityType,
//   cutAlertLocatingTypeId, cutAlertLocatingType,
//   priorityTypeId, priority, workById, workBy, workForId, workFor,
//   companyTypeId, companyType, vendorName, vendorMobileNo, workOnRoute,
//   latLng, address, landmark, remark,
//   chamber1Id, chamber1Name, chamber1LatLong,
//   chamber2Id, chamber2Name, chamber2LatLong,
//   routeId, routeIdStr, routeName, createdOn, currentStatus, isActive, ...
// }
const parseLatLng = (
  raw: string | undefined | null,
): {lat: number; lng: number} | null => {
  if (!raw) return null;
  const parts = String(raw)
    .split(',')
    .map(part => parseFloat(part.trim()));
  if (parts.length !== 2 || parts.some(n => isNaN(n))) return null;
  return {lat: parts[0], lng: parts[1]};
};

const mapApiItemToCardData = (item: any, index: number): AlertCardData => {
  const locatingType = String(item?.cutAlertLocatingType ?? '').trim();
  const isUnderground = locatingType.toLowerCase() === 'underground';
  const badgeLabel = isUnderground ? 'UG' : locatingType ? 'AR' : 'UG';
  const parsedLatLng = parseLatLng(item?.latLng);

  return {
    id: String(item?.id ?? `row-${index}`),
    badgeLabel,
    badgeStyle: isUnderground ? 'primary' : 'secondary',
    alertId: String(item?.activityCode ?? item?.id ?? ''),
    type: String(item?.activityType ?? ''),
    eventStartDate: String(item?.activityCreatedOn ?? ''),
    status: String(
      item?.currentStatus ?? (item?.isActive ? 'Active' : 'Inactive'),
    ),
    priority: String(item?.priority ?? 'N/A'),
    vendorName: String(item?.vendorName ?? '').trim(),
    vendorMobile: String(item?.vendorMobileNo ?? '').trim(),
    workBy: String(item?.workBy ?? '').trim(),
    workingFor: String(item?.workFor ?? '').trim(),
    companyType: String(item?.companyType ?? '').trim(),
    latLong: String(item?.latLng ?? '').trim(),
    address: String(item?.address ?? '').trim(),
    landmark: String(item?.landmark ?? '').trim(),
    gigId: String(item?.routeIdStr ?? item?.chamber1Id ?? ''),
    leftChamber: String(item?.chamber1Name ?? ''),
    rightChamber: String(item?.chamber2Name ?? ''),
    latNum: parsedLatLng?.lat ?? null,
    lngNum: parsedLatLng?.lng ?? null,

    cutAlertLocatingType: locatingType,

    cutAlertLocatingTypeId:
      item?.cutAlertLocatingTypeId != null
        ? Number(item.cutAlertLocatingTypeId)
        : null,

    // ✅ IMPORTANT FIX
    activityStatusId:
      item?.activityStatusId != null ? Number(item.activityStatusId) : null,
  };
};

// ── Display-only date formatter for the card header's "Event Start Date".
// Takes whatever raw string the API sends in `createdOn` (ISO-ish) and
// renders it as "DD-MM-YYYY • hh:mm AM/PM". Falls back to the raw string
// untouched if it can't be parsed, so we never show "Invalid Date".
const formatEventDate = (raw: string): string => {
  if (!raw) return '--';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(parsed.getDate());
  const month = pad(parsed.getMonth() + 1);
  const year = parsed.getFullYear();
  let hours = parsed.getHours();
  const minutes = pad(parsed.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} • ${pad(hours)}:${minutes} ${ampm}`;
};

const AlertCard: FC<{
  item: AlertCardData;
  isNearest?: boolean;
  onLayout?: (h: number) => void;
  onPress?: () => void;
}> = ({item, isNearest = false, onLayout, onPress}) => {
  const isUnderground =
    item.cutAlertLocatingType?.trim().toLowerCase() === 'underground';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.workActivityAlert,
        isNearest && styles.workActivityAlertNearest,
      ]}
      onLayout={
        onLayout ? e => onLayout(e.nativeEvent.layout.height) : undefined
      }>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              isUnderground ? styles.undergroundIconBg : styles.warningIconBg2,
              styles.iconLayout,
            ]}>
            <Text style={[styles.filterText9, styles.filterTypo]}>
              {item.badgeLabel}
            </Text>
          </View>
          <View style={styles.cardHeaderLeftText}>
            <Text
              style={[styles.distanceText, styles.valWorkBy3Typo]}
              numberOfLines={1}>
              {item.alertId}
            </Text>
            <View style={styles.span2}>
              <Text style={styles.labelTypo}>Type:</Text>
              <Text
                style={[
                  styles.cardSubtitle,
                  styles.valWorkBy3Typo,
                  styles.compactValue,
                ]}
                numberOfLines={1}>
                {item.type}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={styles.headerDateRow}>
            <Text style={styles.labelTypo} numberOfLines={1}>
              Event Start Date:
            </Text>
            <Text style={styles.priorityTypo} numberOfLines={1}>
              {formatEventDate(item.eventStartDate)}
            </Text>
          </View>
          <View style={styles.headerStatusItem}>
            <Text style={styles.labelTypo}>Status:</Text>
            <Text style={styles.priorityTypo} numberOfLines={1}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.divider2} />
      <View style={styles.compactRow}>
        <View style={styles.compactCell}>
          <Text style={[styles.compactLabel, styles.labelTypo]}>
            Vendor Name:
          </Text>
          <Text style={styles.valTypo} numberOfLines={1}>
            {item.vendorName}
          </Text>
        </View>
        <View style={styles.compactCell}>
          <Text style={[styles.compactLabel, styles.labelTypo]}>Work By:</Text>
          <Text style={styles.valTypo} numberOfLines={1}>
            {item.workBy}
          </Text>
        </View>
      </View>
      <View style={styles.divider2} />
      <View style={styles.compactRow}>
        <Text style={[styles.compactLabel, styles.labelTypo]}>
          Alert Address:
        </Text>
        <Text style={styles.valTypo} numberOfLines={1}>
          {item.address}
        </Text>
      </View>
      <View style={styles.compactRow}>
        <Text style={[styles.compactLabel, styles.labelTypo]}>Gig ID:</Text>
        <Text
          style={[styles.valWorkBy3, styles.valWorkBy3Typo]}
          numberOfLines={1}>
          {item.gigId}
        </Text>
        {!!item.workBy && (
          <View style={styles.workByBadge}>
            <Text style={styles.workByBadgeText} numberOfLines={1}>
              T {item.workBy}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.compactRow}>
        <View style={styles.compactCell}>
          <Text style={[styles.compactLabel, styles.labelTypo]}>
            Left Chamber:
          </Text>
          <Text
            style={[styles.valWorkBy3, styles.valWorkBy3Typo]}
            numberOfLines={1}>
            {item.leftChamber}
          </Text>
        </View>
        <View style={styles.compactCell}>
          <Text style={[styles.compactLabel, styles.labelTypo]}>
            Right Chamber:
          </Text>
          <Text
            style={[
              styles.valWorkBy3,
              styles.valWorkBy3Typo,
              styles.rightChamberValue,
            ]}
            numberOfLines={1}>
            {item.rightChamber}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AlertScreen: FC<ScreenProps.AlertScreen> = ({navigation}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const handleAlertCardPress = (item: AlertCardData) => {
    const activityStatusId = item?.activityStatusId;
    console.log('Alert → Continuity activityStatusId:', activityStatusId);
    console.log('Alert item:', item);
    if (activityStatusId == null) {
      Common.showToast('Activity Status ID not found');
      return;
    }
    navigation.navigate('ContunityScreen', {
      id: String(activityStatusId),
    });
  };
  const [range, setRange] = useState(1000);
  const [activeTab, setActiveTab] = useState<string>('All');
  // ── Activity Type tabs — sourced from getMaintenanceActivityDDAPI ─ ─ ─ ─ ─ ─ ─
  const [activityTypeMaster, setActivityTypeMaster] = useState<
    ActivityTypeMaster[]
  >([]);
  const [isTabsLoading, setIsTabsLoading] = useState(false);
  // ── Current GPS position — used as lat/lng for getMaintenanceActivityDetailsAPI
  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(null);
  // ── Activity list (from getMaintenanceActivityDetailsAPI) ────────────────
  const [activityData, setActivityData] = useState<AlertCardData[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  // ── Card heights + nearest-card tracking, used to position the vertical
  // dashed line + pin marker next to whichever alert card is closest to the
  // user's current GPS position.
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  // ── Auto-scroll-to-nearest support ────────────────────────────────────
  // `scrollViewRef` lets us imperatively scroll the activity list.
  // `listViewportHeight` is the *visible* height of that scroll container
  // (measured via onLayout), used to center the nearest card in the
  // viewport rather than just scrolling it to the top edge.
  const scrollViewRef = useRef<ScrollView>(null);
  const [listViewportHeight, setListViewportHeight] = useState(0);

  const listScrollOffsetRef = useRef(0);
  const initialNearestScrollDoneRef = useRef(false);
  const lastScrolledNearestIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const lastRequestKeyRef = useRef<string | null>(null);
  // Real GPS fix once available, otherwise the fallback — used both for the
  // API calls and for the on-screen distance tracking (dashed line + pin).
  const effectiveCoords = coords ?? DEFAULT_COORDS;
  const handleDecreaseRange = () => {
    setRange(prev => Math.max(MIN_RANGE, prev - RANGE_STEP));
  };
  const handleIncreaseRange = () => {
    setRange(prev => prev + RANGE_STEP);
  };
  const handleCardLayout = (id: string, h: number) =>
    setCardHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));
  // ── Get current GPS position once on mount ────────────────────────────────
  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        // A real GPS fix just landed (we started out on DEFAULT_COORDS).
        // Let the nearest-card auto-scroll run its "initial load, always
        // center" pass again once the list refetches with the accurate
        // coordinates — otherwise the screen stays scrolled to whatever
        // was nearest under the fallback location.
        initialNearestScrollDoneRef.current = false;
        lastScrolledNearestIdRef.current = null;
      },
      error => {
        Common.showToast(error?.message ?? 'Unable to fetch current location');
      },
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 10000},
    );
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      lastRequestKeyRef.current = null;
      setRefreshKey(prev => prev + 1);
    }, []),
  );

  // ── Debounce search text (150ms) so we don't hit the API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ── Fetch activity type tabs ───────────────────────────────────────────
  useEffect(() => {
    const fetchActivityTypes = async () => {
      try {
        setIsTabsLoading(true);
        // @ts-ignore - unwrap() typing depends on your store setup
        const result = await dispatch(getMaintenanceActivityDDAPI()).unwrap();
        const list: ActivityTypeMaster[] = Array.isArray(result?.activityType)
          ? result.activityType
          : [];
        setActivityTypeMaster(list);
      } catch (e: any) {
        Common.showToast(
          e?.message || e || 'Failed to load activity type tabs',
        );
        setActivityTypeMaster([]);
      } finally {
        setIsTabsLoading(false);
      }
    };
    fetchActivityTypes();
  }, [dispatch]);
  // Tab order:
  //   1. All
  //   2. API activity tabs except Alert and Locating
  //   3. OH
  //   4. UG
  //
  // OH / UG are local locating filters, so they do not need a new backend
  // activityTypeId. The details API is requested with activityTypeId = 0 and
  // the response is then filtered by cutAlertLocatingType.
  const tabs: TabItem[] = useMemo(
    () => [
      ALL_TAB,
      ...activityTypeMaster
        .filter(
          item =>
            !['alert', 'locating'].includes(
              String(item.displayName).trim().toLowerCase(),
            ),
        )
        .map(item => ({
          key: String(item.displayName),
          label: String(item.displayName),
          activityTypeId: Number(item.id),
          filterType: 'api' as const,
        })),
      OH_TAB,
      UG_TAB,
    ],
    [activityTypeMaster],
  );
  // If the tab the user currently has selected disappears from a fresh API
  // response, fall back to "All".
  useEffect(() => {
    if (!tabs.some(tab => tab.key === activeTab)) {
      setActiveTab('All');
    }
  }, [tabs, activeTab]);

  const activeTabItem = useMemo(
    () => tabs.find(tab => tab.key === activeTab) ?? ALL_TAB,
    [tabs, activeTab],
  );

  const isLocatingTab = activeTabItem.filterType === 'locating';

  const matchesLocatingTab = (row: any): boolean => {
    if (!isLocatingTab) return true;

    const locatingType = String(row?.cutAlertLocatingType ?? '')
      .trim()
      .toLowerCase();

    if (activeTabItem.locatingType === 'UG') {
      return locatingType === 'underground' || locatingType === 'ug';
    }

    if (activeTabItem.locatingType === 'OH') {
      return (
        locatingType === 'overhead' ||
        locatingType === 'oh' ||
        locatingType === 'aerial' ||
        locatingType === 'og'
      );
    }

    return true;
  };

  // Reset measured card heights whenever the list changes so stale heights
  // from a previous tab/search never get applied to the new cards.
  useEffect(() => {
    setCardHeights({});
    listScrollOffsetRef.current = 0;

    // Fresh screen/tab/search data:
    // allow nearest card to auto-scroll again.
    initialNearestScrollDoneRef.current = false;
    lastScrolledNearestIdRef.current = null;

    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [activeTabItem.activityTypeId, debouncedSearchText]);
  // ── Fetch activity details whenever tab / search / range / coords change ─
  // This is the paid endpoint — it now always sends the REAL activityTypeId
  // for whichever tab is active, plus the device's actual lat/lng and the
  // range currently selected (all previously hardcoded). A request-key guard
  // stops it from firing twice in a row for identical params (e.g. an extra
  // re-render right after tapping the same tab).
  useEffect(() => {
    // Always resolve to a usable coordinate — real GPS fix once available,
    // otherwise the fallback — so tapping a tab calls the API immediately
    // instead of silently doing nothing while location is still resolving.
    // OH / UG are locating-type filters, not activity types. For those
    // tabs the backend must receive activityTypeId=0 (All activity types),
    // then we filter the returned rows locally.
    const apiActivityTypeId =
      activeTabItem.filterType === 'locating'
        ? 0
        : activeTabItem.activityTypeId;

    const requestKey = JSON.stringify({
      search: debouncedSearchText ?? '',
      tab: activeTabItem.key,
      activityTypeId: apiActivityTypeId,
      range,
      lat: effectiveCoords.lat,
      lng: effectiveCoords.lng,
    });
    if (requestKey === lastRequestKeyRef.current) {
      return;
    }
    lastRequestKeyRef.current = requestKey;

    const currentRequestId = ++requestIdRef.current;

    // De-dupe helper — the live API has been seen returning the same
    // activity id more than once in a single response, so both the static
    // and live paths run through this before mapping.
    const dedupeById = (list: any[]) => {
      const seenIds = new Set<string>();
      return list.filter(row => {
        const rowId = String(row?.id ?? row?.activityId ?? '');
        if (!rowId || seenIds.has(rowId)) {
          return false;
        }
        seenIds.add(rowId);
        return true;
      });
    };
    // Filters the static payload the same way the backend would for a given
    // tab + search term, so switching tabs still "feels" live even though
    // we're not hitting the paid endpoint right now.
    const applyTabAndSearchFilter = (list: any[]) => {
      let tabFiltered: any[];

      if (activeTabItem.filterType === 'locating') {
        tabFiltered = list.filter(matchesLocatingTab);
      } else if (activeTabItem.activityTypeId === 0) {
        tabFiltered = list;
      } else {
        tabFiltered = list.filter(
          row => Number(row?.activityTypeId) === activeTabItem.activityTypeId,
        );
      }

      const query = debouncedSearchText.trim().toLowerCase();
      if (!query) {
        return tabFiltered;
      }
      return tabFiltered.filter(row => {
        const haystack = [
          row?.activityCode,
          row?.vendorName,
          row?.address,
          row?.landmark,
          row?.companyType,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    };

    const fetchDetails = async () => {
      try {
        setIsDataLoading(true);

        let list: any[];

        if (USE_STATIC_DATA) {
          list = [];
        } else {
          const result = await dispatch(
            getMaintenanceActivityDetailsAPI({
              search: debouncedSearchText ?? '',
              activityTypeId: apiActivityTypeId,
              rangeInMeter: range,
              lat: effectiveCoords.lat,
              lng: effectiveCoords.lng,
            }),
          ).unwrap();
          const rawList = Array.isArray(result) ? result : result?.data ?? [];
          list = dedupeById(rawList);
        }
        // Ignore stale response if a newer request has since started.
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        // Apply the two additional OH / UG filters after the API response.
        // API-provided activity tabs continue to use their real activityTypeId.
        const visibleList = list.filter(
          row =>
            String(row?.activityType ?? '')
              .trim()
              .toLowerCase() !== 'locating',
        );
        const filteredList = isLocatingTab
          ? visibleList.filter(matchesLocatingTab)
          : visibleList;
        setActivityData(filteredList.map(mapApiItemToCardData));
      } catch (e: any) {
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        Common.showToast(
          e?.message || e || 'Failed to load maintenance activity details',
        );
        setActivityData([]);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsDataLoading(false);
        }
      }
    };
    fetchDetails();
  }, [
    dispatch,
    debouncedSearchText,
    activeTabItem.key,
    activeTabItem.activityTypeId,
    activeTabItem.filterType,
    activeTabItem.locatingType,
    isLocatingTab,
    range,
    coords,
    refreshKey,
  ]);
  // ── Nearest-alert tracking (drives the dashed line + pin marker) ─────────
  const nearestAlertId = useMemo(() => {
    if (!activityData.length) return null;
    let minDist = Infinity;
    let nearestId: string | null = null;
    activityData.forEach(item => {
      if (item.latNum == null || item.lngNum == null) return;
      const d = haversineDistance(
        effectiveCoords.lat,
        effectiveCoords.lng,
        item.latNum,
        item.lngNum,
      );
      if (d < minDist) {
        minDist = d;
        nearestId = item.id;
      }
    });
    return nearestId;
  }, [activityData, effectiveCoords]);
  const nearestDistanceMeters = useMemo(() => {
    if (!nearestAlertId) return null;
    const item = activityData.find(i => i.id === nearestAlertId);
    if (!item || item.latNum == null || item.lngNum == null) return null;
    return haversineDistance(
      effectiveCoords.lat,
      effectiveCoords.lng,
      item.latNum,
      item.lngNum,
    );
  }, [nearestAlertId, activityData, effectiveCoords]);
  // Index of the nearest card within the current list — used below to check
  // whether every card ABOVE it has already reported a real measured height,
  // which is what makes the auto-scroll's target position trustworthy.
  const nearestIndex = useMemo(
    () => activityData.findIndex(item => item.id === nearestAlertId),
    [activityData, nearestAlertId],
  );

  // True only once we have a REAL measured height (from AlertCard's
  // onLayout) for the nearest card and every card above it — i.e. the
  // cumulative offset used to center it is exact, not guessed via
  // DEFAULT_CARD_HEIGHT. Until this is true we keep refining the scroll
  // position on every layout update instead of locking in a rough guess.
  const nearestScrollTargetIsAccurate = useMemo(() => {
    if (nearestIndex < 0 || !nearestAlertId) return false;
    for (let i = 0; i <= nearestIndex; i++) {
      if (cardHeights[activityData[i].id] == null) return false;
    }
    return true;
  }, [activityData, nearestIndex, nearestAlertId, cardHeights]);
  const getCardTop = (id: string): number => {
    const idx = activityData.findIndex(item => item.id === id);
    if (idx < 0) return -999;
    let top = 0;
    for (let i = 0; i < idx; i++) {
      const rowId = activityData[i].id;
      top += (cardHeights[rowId] ?? DEFAULT_CARD_HEIGHT) + CARD_GAP;
    }
    return top;
  };
  const getPinTop = (): number => {
    if (!nearestAlertId) return -999;
    const top = getCardTop(nearestAlertId);
    if (top < 0) return -999;
    const cardHeight = cardHeights[nearestAlertId] ?? DEFAULT_CARD_HEIGHT;
    return top + cardHeight / 2 - PIN_SIZE / 2;
  };
  useEffect(() => {
    if (!nearestAlertId) return;
    if (!listViewportHeight) return;
    if (!activityData.length) return;

    const timer = setTimeout(() => {
      const cardTop = getCardTop(nearestAlertId);
      if (cardTop < 0) return;
      const cardHeight = cardHeights[nearestAlertId] ?? DEFAULT_CARD_HEIGHT;
      const cardBottom = cardTop + cardHeight;
      const currentScrollY = listScrollOffsetRef.current;
      const visibleTop = currentScrollY;
      const visibleBottom = currentScrollY + listViewportHeight;
      const VISIBILITY_PADDING = 12;
      const isInitialLoad = !initialNearestScrollDoneRef.current;
      const isAboveVisibleArea = cardBottom < visibleTop + VISIBILITY_PADDING;
      const isBelowVisibleArea = cardTop > visibleBottom - VISIBILITY_PADDING;
      // ---------------------------------------------------------
      // FIRST LOAD:
      // Always scroll to nearest, even if it currently appears
      // inside the first viewport. Keep re-centering (snap, not
      // animated) as more card heights come in from onLayout, and
      // only mark the initial scroll "done" once the position is
      // backed by real measurements for every card above it —
      // otherwise a rough DEFAULT_CARD_HEIGHT guess can lock in a
      // slightly-off scroll target before layout has settled.
      // ---------------------------------------------------------
      if (isInitialLoad) {
        const cardCenter = cardTop + cardHeight / 2;
        const targetY = Math.max(0, cardCenter - listViewportHeight / 2);
        scrollViewRef.current?.scrollTo({
          y: targetY,
          animated: nearestScrollTargetIsAccurate,
        });
        if (nearestScrollTargetIsAccurate) {
          initialNearestScrollDoneRef.current = true;
          lastScrolledNearestIdRef.current = nearestAlertId;
        }
        return;
      }
      if (!isAboveVisibleArea && !isBelowVisibleArea) {
        return;
      }
      const cardCenter = cardTop + cardHeight / 2;
      const targetY = Math.max(0, cardCenter - listViewportHeight / 2);
      scrollViewRef.current?.scrollTo({
        y: targetY,
        animated: true,
      });
      lastScrolledNearestIdRef.current = nearestAlertId;
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nearestAlertId,
    cardHeights,
    listViewportHeight,
    activityData,
    nearestScrollTargetIsAccurate,
  ]);
  return (
    <Screen
      preset="fixed"
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle="dark">
      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.back}
            />
          </Pressable>
          <Text style={styles.cutCss}>Alerts</Text>
          <View style={styles.rightPlaceholder} />
        </View>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: coords?.lat ?? 28.62648628,
            longitude: coords?.lng ?? 77.2308646,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton>
          {coords && (
            <Marker
              coordinate={{latitude: coords.lat, longitude: coords.lng}}
              title="Alert Location"
            />
          )}
          {/* NEW: current tab ke sabhi activities ke lat/long markers */}
          {activityData
            .filter(item => item.latNum != null && item.lngNum != null)
            .map(item => (
              <Marker
                key={`marker-${item.id}`}
                coordinate={{
                  latitude: item.latNum as number,
                  longitude: item.lngNum as number,
                }}
                title={item.alertId || item.type}
                description={item.address}
                pinColor={item.id === nearestAlertId ? 'green' : 'red'}
              />
            ))}
        </MapView>
        <View style={[styles.inner, styles.innerFlexBox]}>
          <View style={[styles.row, styles.rowFlexBox]}>
            <View
              style={[
                styles.col,
                styles.colFlexBox1,
                styles.searchRangeControl,
              ]}>
              <View style={[styles.filter, styles.listLayout]}>
                <View style={[styles.span, styles.spanFlexBox]}>
                  <Image
                    source={IMAGES.search}
                    style={styles.vectorIcon}
                    resizeMode="cover"
                  />
                  <TextInput
                    style={styles.filterText}
                    placeholder="Search"
                    placeholderTextColor={COLORS.colorSlategray100}
                    value={searchText}
                    onChangeText={setSearchText}
                    returnKeyType="search"
                  />
                </View>
                {searchText.length > 0 && (
                  <LinearGradient
                    style={[styles.plus, styles.plusBorder]}
                    locations={[0, 1]}
                    colors={['#f7f6f6', '#f4f3f3']}
                    useAngle={true}
                    angle={180}>
                    <TouchableOpacity
                      onPress={() => setSearchText('')}
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                      <Image
                        source={IMAGES.close}
                        style={styles.vectorIcon2}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </LinearGradient>
                )}
              </View>
            </View>
            <View
              style={[
                styles.col2,
                styles.colFlexBox1,
                styles.searchRangeControl,
              ]}>
              <View style={[styles.filter, styles.listLayout]}>
                <LinearGradient
                  style={[styles.plus, styles.plusBorder]}
                  locations={[0, 1]}
                  colors={['#f7f6f6', '#f4f3f3']}
                  useAngle={true}
                  angle={180}>
                  <TouchableOpacity
                    onPress={handleDecreaseRange}
                    disabled={range <= MIN_RANGE}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Image
                      source={IMAGES.minusIcon}
                      style={styles.vectorIcon3}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </LinearGradient>
                <Text style={[styles.filterText2, styles.filterTypo1]}>
                  {range}m
                </Text>
                <LinearGradient
                  style={[styles.plus, styles.plusBorder]}
                  locations={[0, 1]}
                  colors={['#f7f6f6', '#f4f3f3']}
                  useAngle={true}
                  angle={180}>
                  <TouchableOpacity
                    onPress={handleIncreaseRange}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                    <Image
                      source={IMAGES.plus}
                      style={styles.vectorIcon4}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabScroll}
            contentContainerStyle={styles.tabScrollContent}>
            <View style={styles.tab}>
              {isTabsLoading && tabs.length <= 1 ? (
                <View style={styles.tabLoadingRow}>
                  <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                  <Text style={styles.tabLoadingText}>Loading tabs...</Text>
                </View>
              ) : (
                tabs.map(tabItem => {
                  const isActive = activeTab === tabItem.key;
                  return (
                    <TouchableOpacity
                      key={`${tabItem.key}-${tabItem.activityTypeId}`}
                      activeOpacity={0.8}
                      style={[
                        isActive
                          ? [styles.col4, styles.colFlexBox]
                          : [styles.col3, styles.col3Border],
                      ]}
                      onPress={() => setActiveTab(tabItem.key)}>
                      <Text
                        style={
                          isActive ? styles.filterTypo : styles.filterTypo1
                        }>
                        {tabItem.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
          <View style={styles.formBody}>
            <ScrollView
              ref={scrollViewRef}
              style={[styles.list, styles.listLayout]}
              contentContainerStyle={styles.listContainerContentVertical}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              onScroll={e => {
                listScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              onLayout={e => {
                setListViewportHeight(e.nativeEvent.layout.height);
              }}>
              {isDataLoading ? (
                <View style={styles.tabLoadingRow}>
                  <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                  <Text style={styles.tabLoadingText}>
                    Loading activities...
                  </Text>
                </View>
              ) : activityData.length > 0 ? (
                <View style={styles.pitListContainer}>
                  <View style={styles.dashLineCol} pointerEvents="none">
                    <VerticalDashedLineAutoHeight
                      left={DASH_COL_WIDTH / 2 - DASH_W / 2}
                      color={COLORS.colorDimgray ?? '#888'}
                      opacity={0.5}
                    />
                    {nearestAlertId &&
                      (() => {
                        const pinTop = getPinTop();
                        if (pinTop < 0) return null;
                        return (
                          <View
                            style={[
                              styles.pinMarkerAbs,
                              {
                                top: pinTop,
                              },
                            ]}
                            pointerEvents="none">
                            <Image
                              source={IMAGES.locationCheck}
                              style={styles.locationCheckIcon}
                              resizeMode="contain"
                            />
                            {nearestDistanceMeters != null && (
                              <Text
                                style={styles.distanceAwayText}
                                numberOfLines={2}>
                                {formatDistance(nearestDistanceMeters)}
                                {'\n'}away
                              </Text>
                            )}
                          </View>
                        );
                      })()}
                  </View>
                  <View style={styles.alertListCol}>
                    {activityData.map(item => (
                      <AlertCard
                        key={item.id}
                        item={item}
                        isNearest={item.id === nearestAlertId}
                        onLayout={h => handleCardLayout(item.id, h)}
                        onPress={() => handleAlertCardPress(item)}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.labelTypo}>
                  No records found for this tab.
                </Text>
              )}
            </ScrollView>
          </View>
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 20,
              justifyContent: 'flex-end',
            }}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('AddCutScreen', {
                  cutAlertLocatingType: 'Cut',
                })
              }
              style={styles.activity}>
              <Text style={styles.txt1}>+ Add Activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Screen>
  );
};
export default AlertScreen;

// ─── Vertical dashed-line tracking (same approach as AddNewPIT) ────────────
const DASH_COL_WIDTH = 24;
const DASH_W = 1.5;
const DASH_H = 5;
const DASH_GAP = 4;
const CARD_GAP = 8;
const PIN_SIZE = 16;
const DEFAULT_CARD_HEIGHT = 140;

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

const formatDistance = (meters: number): string =>
  meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2)} km`;

const VerticalDashedLine: FC<{
  height: number;
  color?: string;
  opacity?: number;
}> = ({height, color = COLORS.colorDimgray ?? '#888', opacity = 0.5}) => {
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
}> = ({left, color, opacity}) => {
  const [h, setH] = useState(0);
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={e => setH(e.nativeEvent.layout.height)}>
      <View style={{position: 'absolute', top: 0, left}}>
        {h > 0 && (
          <VerticalDashedLine height={h} color={color} opacity={opacity} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainerContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 2,
  },
  locationCheckIcon: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
  },
  listContainerContentVertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  pitListContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  dashLineCol: {
    width: DASH_COL_WIDTH,
    position: 'relative',
    marginRight: 6,
  },
  alertListCol: {
    flex: 1,
    flexDirection: 'column',
    gap: CARD_GAP,
  },
  pinMarkerAbs: {
    position: 'absolute',
    right: -25, // was a negative offset that pushed it off-screen and got clipped by the ScrollView
    width: DASH_COL_WIDTH + 44, // extend rightward instead of left, stays inside visible bounds
    alignItems: 'center',
    zIndex: 2,
    elevation: 2, // ensures it draws above the dashed line / cards on Android
  },
  pinDot: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: COLORS.PRIMARY,
    borderWidth: 2,
    borderColor: COLORS.colorWhite,
    elevation: 3,
  },
  distanceAwayText: {
    marginTop: 2,
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
  },
  nearestTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6F9EE',
    borderRadius: Border.br_5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
  },
  nearestTagText: {
    fontSize: FontSize.fs_10,
    color: COLORS.SUCCESS ?? '#3EC21E',
    fontFamily: FONTS.REGULAR,
    fontWeight: '600',
  },
  workActivityAlertNearest: {
    borderWidth: 1.5,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
  },
  map: {
    marginVertical: SIZE.MS(20),
    width: '100%',
    aspectRatio: 2.2,
    borderRadius: 12,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  innerFlexBox: {
    gap: Gap.gap_12,
    alignItems: 'flex-start',
  },
  mapIcon: {
    marginVertical: SIZE.MS(20),
    height: SIZE.MS(150),
    width: '92%',
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  rowFlexBox: {
    gap: Gap.gap_6,
    alignItems: 'flex-start',
  },
  colFlexBox1: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRangeControl: {
    height: 33,
  },
  listLayout: {
    maxWidth: '100%',
    flex: 1,
  },
  spanFlexBox: {
    gap: Gap.gap_10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  plusBorder: {
    borderColor: 'transparent',
    borderStyle: 'solid',
    overflow: 'hidden',
  },
  filterTypo1: {
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    fontSize: FontSize.fs_13,
  },
  col3Border: {
    borderRadius: Border.br_26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_6,
  },
  colFlexBox: {
    borderRadius: Border.br_26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY,
  },
  iconLayout: {
    width: Width.width_28,
    height: Height.height_28,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  col4ShadowBox: {
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
  },
  headerFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterTypo: {
    color: COLORS.colorWhite,
    textAlign: 'center',
    fontFamily: FONTS.REGULAR,
    fontSize: FontSize.fs_13,
  },
  valWorkBy3Typo: {
    fontWeight: '600',
    fontSize: FontSize.fs_10,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  labelTypo: {
    color: COLORS.colorSlategray200,
    fontSize: FontSize.fs_10,
    fontWeight: '500',
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  priorityTypo: {
    fontSize: FontSize.fs_10,
    fontWeight: '500',
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  valTypo: {
    color: COLORS.BLACK,
    fontSize: FontSize.fs_10,
    fontWeight: '500',
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
    flex: 1,
  },
  inner: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
    paddingVertical: Padding.padding_0,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  col: {
    paddingLeft: Padding.padding_12,
    paddingTop: Padding.padding_4,
    paddingRight: Padding.padding_4,
    paddingBottom: Padding.padding_4,
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_6,
    justifyContent: 'center',
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    flexDirection: 'row',
    flex: 1,
  },
  filter: {
    gap: Gap.gap_2,
    alignItems: 'center',
    flexDirection: 'row',
  },
  span: {
    flex: 1,
  },
  vectorIcon: {
    height: 13.5,
    width: 13.5,
  },
  filterText: {
    color: COLORS.colorSlategray100,
    opacity: 1,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
    fontSize: FontSize.fs_13,
    flex: 1,
    padding: 0,
    margin: 0,
    height: 25,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  plus: {
    height: 25,
    width: 25,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderRadius: Border.br_5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vectorIcon2: {
    width: 9,
    height: 9,
  },
  col2: {
    width: 109,
    padding: Padding.padding_4,
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_6,
    justifyContent: 'center',
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    flexDirection: 'row',
  },
  vectorIcon3: {
    width: 11.5,
    height: 1.5,
  },
  filterText2: {
    flex: 1,
  },
  vectorIcon4: {
    width: 12,
    height: 12,
  },
  tabScroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  tabScrollContent: {
    flexGrow: 0,
  },
  tab: {
    gap: Gap.gap_8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    paddingRight: 4,
  },
  tabLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  tabLoadingText: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
  },
  col3: {
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_6,
    borderRadius: Border.br_26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    backgroundColor: COLORS.colorWhite,
  },
  filterText3: {
    fontWeight: '500',
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    fontSize: FontSize.fs_13,
  },
  col4: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  formBody: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    flex: 1,
  },
  list: {
    alignSelf: 'stretch',
  },
  scrollBody: {
    alignSelf: 'stretch',
    width: '100%',
  },
  workActivityAlert: {
    borderRadius: Border.br_8,
    padding: Padding.padding_12,
    width: '100%',
    backgroundColor: COLORS.colorWhite,
    gap: Gap.gap_6,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    paddingVertical: 2,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  cardHeaderLeftText: {
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: '55%',
    flexShrink: 1,
  },
  headerDateRow: {
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  headerStatusItem: {
    gap: 2,
    maxWidth: 64,
    flexShrink: 1,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 6,
    minHeight: 15,
  },
  compactCell: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  compactLabel: {
    width: 78,
  },
  compactValue: {
    flexShrink: 1,
  },
  workByBadge: {
    backgroundColor: '#0098FF',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: '30%',
  },
  workByBadgeText: {
    color: COLORS.colorWhite,
    fontFamily: FONTS.REGULAR,
    fontSize: FontSize.fs_10,
    fontWeight: '600',
  },
  rightChamberValue: {
    borderWidth: 1,
    borderColor: '#0098FF',
    paddingHorizontal: 2,
  },
  headerRow: {
    justifyContent: 'space-between',
    gap: 0,
    alignSelf: 'stretch',
  },
  headerLeft: {
    gap: Gap.gap_8,
    flex: 1,
  },
  warningIconBg: {
    backgroundColor: COLORS.WARNING,
    borderRadius: Border.br_5,
  },
  filterText9: {
    fontWeight: '700',
    alignSelf: 'center',
  },
  titleGroup: {
    flex: 1,
  },
  distanceText: {
    letterSpacing: 0.2,
    color: COLORS.colorMediumvioletred,
    alignSelf: 'flex-start',
  },
  span2: {
    gap: Gap.gap_3,
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  cardSubtitle: {
    color: COLORS.colorDarkorange,
  },
  ul3: {
    gap: 9,
  },
  priorityPill: {
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_2,
    borderRadius: Border.br_5,
    gap: Gap.gap_2,
    alignItems: 'flex-start',
  },
  priorityText: {
    alignSelf: 'flex-start',
  },
  ul4: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  priorityText4: {
    alignSelf: 'flex-start',
  },
  divider2: {
    height: 0,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    alignSelf: 'stretch',
  },
  specsTable: {
    alignSelf: 'stretch',
  },
  specRow1: {
    flexDirection: 'row',
    flex: 1,
  },
  labelWorkBy2: {
    width: 73.1,
  },
  labelWorkingFor: {
    width: 90,
  },
  valCompany: {
    overflow: 'hidden',
  },
  row2: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  valWorkBy3: {
    color: COLORS.colorRoyalblue200,
    flex: 1,
  },
  row4: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  warningIconBg2: {
    backgroundColor: COLORS.colorCadetblue,
    borderRadius: Border.br_5,
  },
  undergroundIconBg: {
    backgroundColor: '#c933a4',
    borderRadius: Border.br_6,
  },
  body: {
    height: '100%',
    paddingHorizontal: Padding.padding_16,
    paddingTop: 12,
    flex: 1,
    width: '100%',
  },
  main: {
    gap: 22,
    alignSelf: 'stretch',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    alignSelf: 'stretch',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  cutCss: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    fontWeight: '500',
  },
  rightPlaceholder: {
    width: 40,
  },
  activity: {
    backgroundColor: '#2b67ed',
    justifyContent: 'center',
    width: '100%',
    alignItems: 'center',
    paddingVertical: SIZE.MS(10),
    borderRadius: SIZE.MS(8),
  },
  txt1: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
  },
});
