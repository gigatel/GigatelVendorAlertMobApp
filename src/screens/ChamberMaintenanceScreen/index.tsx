import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import MapView, {Marker, PROVIDER_GOOGLE, Region} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {Common, Preferences} from '@utils';
import {useFocusEffect} from '@react-navigation/native';
import {
  Gap,
  Padding,
  Border,
  FontFamily,
  FontSize,
  LineHeight,
  LetterSpacing,
  BoxShadow,
  Opacity,
  Height,
} from '../../res/globalStyle';
import {getAssignedChamberComplaintsAPI} from '../../store/slices/maintenance.slice';
import type {AppDispatch, RootState} from '@reducers';
type ChamberItem = {
  id: string;
  chamberId: string;
  chamberName: string;
  routeName: string;
  typeOfWork: string;
  complaintNo: string;
  ptCode: string;
  status: string;
  zone: string;
  routeId: string;
  address: string;
  landmark: string;
  fromChamberId: string;
  lat: number;
  long: number;
  distanceM: number | null;
  outOfRange?: boolean;
  images: string[];
  rawData?: any;
};
const DEFAULT_RADIUS_M = 250;
const RADIUS_STEP_M = 50;
const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 2000;
const DASH_COL_WIDTH = 24;
const DASH_W = 1.5;
const DASH_H = 5;
const DASH_GAP = 4;
const CARD_GAP = 8;
const PIN_SIZE = 16;
const DEFAULT_CARD_HEIGHT = 140;
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

// Image sheet grid layout (2 columns)
const SHEET_PADDING = 16;
const GRID_GAP = 10;
const GRID_COLS = 2;
const GRID_TILE_W =
  (SCREEN_W - SHEET_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_TILE_H = GRID_TILE_W * 0.85;
// If the API returns relative image paths (e.g. "/uploads/abc.jpg"),
// set this to your server base URL (e.g. 'https://example.com'). Leave
// empty if the API already returns full http(s) URLs.
const BASE_URL = '';
// Possible keys in the API payload that can hold image(s). Add yours here
// if the backend uses a different field name.
// const IMAGE_KEYS = ['followUpImageUrls', 'imageUrls'];

const toUrl = (v: any): string | null => {
  let s: any = v;
  if (v && typeof v === 'object') {
    s =
      v.url ??
      v.imageUrl ??
      v.image ??
      v.path ??
      v.filePath ??
      v.fileUrl ??
      v.src ??
      null;
  }
  if (typeof s !== 'string') return null;
  s = s.trim();
  if (!s) return null;
  // API returns Windows-style paths ("...\\DESHBANDU RED...\\2026-Oct\\x.png")
  // with spaces — convert "\" to "/" and URL-encode spaces etc.
  s = s.replace(/\\+/g, '/');
  if (!/^data:/i.test(s)) {
    try {
      s = encodeURI(decodeURI(s));
    } catch (e) {
      s = s.replace(/ /g, '%20');
    }
  }
  if (/^(https?:|file:|content:|data:)/i.test(s)) return s;
  if (!BASE_URL) return s;
  return `${BASE_URL.replace(/\/+$/, '')}/${s.replace(/^\/+/, '')}`;
};

// Assigned complaints → show the original chamber images (imageUrls).
// Every other status → show the follow-up images (followUpImageUrls).
const ASSIGNED_IMAGE_KEYS = ['imageUrls'];
const FOLLOW_UP_IMAGE_KEYS = ['followUpImageUrls'];

// Case-insensitive, so "Assigned" and "assigned" both match.
const isAssignedStatus = (status: any): boolean =>
  String(status ?? '')
    .trim()
    .toLowerCase() === 'assigned';

// Completed complaints must not open the detail screen.
const isCompletedStatus = (status: any): boolean =>
  String(status ?? '')
    .trim()
    .toLowerCase() === 'completed';

const extractImageUrls = (item: any): string[] => {
  if (!item) return [];
  const keys = isAssignedStatus(item?.status)
    ? ASSIGNED_IMAGE_KEYS
    : FOLLOW_UP_IMAGE_KEYS;
  const out: string[] = [];
  keys.forEach(key => {
    const val = item?.[key];
    if (val == null || val === '') return;
    if (Array.isArray(val)) {
      val.forEach(v => {
        const u = toUrl(v);
        if (u) out.push(u);
      });
    } else if (typeof val === 'string') {
      val.split(',').forEach(part => {
        const u = toUrl(part);
        if (u) out.push(u);
      });
    } else {
      const u = toUrl(val);
      if (u) out.push(u);
    }
  });
  return Array.from(new Set(out));
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

const formatDistance = (meters: number | null): string => {
  if (meters == null) return '—';
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2)} km`;
};
const mapComplaintToChamberItem = (item: any, index: number): ChamberItem => ({
  id: String(item?.id ?? index),
  chamberId: String(item?.chamberId ?? item?.fromChamberId ?? item?.id ?? ''),
  complaintNo: String(item?.complaintNo ?? ''),
  chamberName: String(item?.chamberName ?? ''),
  routeName: String(item?.routeName ?? ''),
  ptCode: String(item?.ptCode ?? item?.complaintNo ?? ''),
  status: String(item?.status ?? 'Pending'),
  zone: String(item?.zone ?? ''),
  routeId: String(item?.routeId ?? ''),
  address: String(item?.chamberAddress ?? item?.address ?? ''),
  landmark: String(item?.landmark ?? ''),
  lat: Number(item?.chamberLat ?? item?.lat ?? 0),
  long: Number(item?.chamberLong ?? item?.long ?? 0),
  distanceM: null,
  typeOfWork: String(item?.typeOfWork ?? ''),
  images: extractImageUrls(item),
  // IMPORTANT:
  // Preserve every field received from the API.
  rawData: item,
});
const VerticalDashedLine: FC<{
  height: number;
  color?: string;
  opacity?: number;
}> = ({height, color = COLORS.colorDimgray ?? '#888', opacity = 0.5}) => {
  const count = Math.max(0, Math.floor(height / (DASH_H + DASH_GAP)) + 1);
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
// Measures its OWN rendered height via onLayout so the line runs the full
// length of the list column (down to "Where I am?") even for a single card.
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

// Single grid tile inside the image bottom sheet, with its own loader / error.
const GridImage: FC<{uri: string}> = ({uri}) => {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.gridTile}>
      {!failed && (
        <Image
          source={{uri}}
          style={styles.gridImage}
          resizeMode="cover"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
      {loading && (
        <View style={styles.gridLoader} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.PRIMARY} />
        </View>
      )}
      {failed && (
        <View style={styles.gridError}>
          <Text style={styles.gridErrorText}>Unable to load</Text>
        </View>
      )}
    </View>
  );
};

const ChamberMaintenanceScreen: FC<ScreenProps.ChamberMaintenanceScreen> = ({
  navigation,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  // ⚠️ adjust selector path to wherever maintenanceSlice is mounted in your root reducer
  const {assignedChamberComplaints, assignedChamberComplaintsLoading} =
    useSelector((state: RootState) => state.maintenance);

  const mapRef = useRef<MapView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 28.5535,
    longitude: 77.391,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  // Card heights, measured via onLayout, used to position the dashed-line
  // pin marker next to whichever chamber card is nearest to the user.
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  // Image bottom sheet state
  const [imageViewer, setImageViewer] = useState<{
    visible: boolean;
    images: string[];
    chamberId: string;
    routeId: string;
    routeName: string;
  }>({visible: false, images: [], chamberId: '', routeId: '', routeName: ''});

  const allChambers = useMemo<ChamberItem[]>(
    () =>
      (assignedChamberComplaints ?? []).map((item: any, idx: number) =>
        mapComplaintToChamberItem(item, idx),
      ),
    [assignedChamberComplaints],
  );
  const fetchComplaints = useCallback(async () => {
    await dispatch(getAssignedChamberComplaintsAPI());
  }, [dispatch]);
  useFocusEffect(
    useCallback(() => {
      fetchComplaints();
    }, [fetchComplaints]),
  );
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchComplaints();
    setRefreshing(false);
  }, [fetchComplaints]);
  const chambers = useMemo(() => {
    if (!searchText.trim()) return allChambers;
    const q = searchText.trim().toLowerCase();
    return allChambers.filter(
      c =>
        c.ptCode.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.landmark.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q),
    );
  }, [allChambers, searchText]);
  useEffect(() => {
    setCardHeights({});
  }, [chambers]);

  const handleCardLayout = useCallback((id: string, h: number) => {
    setCardHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));
  }, []);
  // Distances are computed here once userLocation is known, since the API
  // doesn't return a distanceM field.
  const chambersWithDistance = useMemo(() => {
    if (!userLocation) return chambers;
    return chambers.map(c => ({
      ...c,
      distanceM: haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        c.lat,
        c.long,
      ),
    }));
  }, [chambers, userLocation]);
  // ── Nearest-chamber tracking (drives the dashed line + pin marker) ─────
  const nearestChamberId = useMemo(() => {
    if (!chambersWithDistance.length) return null;
    if (userLocation) {
      let minDist = Infinity;
      let nearestId: string | null = null;
      chambersWithDistance.forEach(item => {
        const d = item.distanceM ?? Infinity;
        if (d < minDist) {
          minDist = d;
          nearestId = item.id;
        }
      });
      return nearestId;
    }
    return chambersWithDistance[0]?.id ?? null;
  }, [chambersWithDistance, userLocation]);
  const nearestDistanceMeters = useMemo(() => {
    if (!nearestChamberId) return null;
    const item = chambersWithDistance.find(i => i.id === nearestChamberId);
    return item?.distanceM ?? null;
  }, [nearestChamberId, chambersWithDistance]);
  // getCardTop sums each preceding card's measured height + CARD_GAP.
  // Exact only when nothing besides CARD_GAP is rendered between cards.
  const getCardTop = useCallback(
    (id: string): number => {
      const idx = chambersWithDistance.findIndex(item => item.id === id);
      if (idx < 0) return -999;
      let top = 0;
      for (let i = 0; i < idx; i++) {
        const rowId = chambersWithDistance[i].id;
        top += (cardHeights[rowId] ?? DEFAULT_CARD_HEIGHT) + CARD_GAP;
      }
      return top;
    },
    [chambersWithDistance, cardHeights],
  );
  const getPinTop = useCallback((): number => {
    if (!nearestChamberId) return -999;
    const top = getCardTop(nearestChamberId);
    if (top < 0) return -999;
    const cardHeight = cardHeights[nearestChamberId] ?? DEFAULT_CARD_HEIGHT;
    return top + cardHeight / 2 - PIN_SIZE / 2;
  }, [nearestChamberId, getCardTop, cardHeights]);

  const decreaseRadius = useCallback(() => {
    setRadiusM(prev => Math.max(MIN_RADIUS_M, prev - RADIUS_STEP_M));
  }, []);

  const increaseRadius = useCallback(() => {
    setRadiusM(prev => Math.min(MAX_RADIUS_M, prev + RADIUS_STEP_M));
  }, []);

  const handleExpandMap = useCallback(() => {
    navigation?.navigate?.('ChamberMaintenanceMapFullScreen', {
      chambers: chambersWithDistance,
      radiusM,
    });
  }, [navigation, chambersWithDistance, radiusM]);

  // "Where I am?" only recenters the map on the user's current GPS location.
  const handleWhereIAm = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  }, [userLocation]);
  const handleCardPress = useCallback(
    (item: ChamberItem) => {
      // Completed complaints are read-only → don't open the detail screen.
      if (isCompletedStatus(item.status)) return;
      navigation.navigate('MaintenanceDetailScreen', {
        id: item.id,
        chamberId: item.fromChamberId,
        chamberName: item.chamberName,
        complaintNo: item.complaintNo,
        ptCode: item.ptCode,
        routeName: item.routeName,
        typeOfWork: item.typeOfWork,
        status: item.status,
        zone: item.zone,
        address: item.address,
        landmark: item.landmark,
        lat: item.lat,
        long: item.long,
        distanceM: item.distanceM,
        outOfRange: item.outOfRange,
        ...item.rawData,
        chamber: item,
      });
    },
    [navigation],
  );
  const handleViewImages = useCallback((item: ChamberItem) => {
    if (!item.images || item.images.length === 0) {
      Alert.alert(
        'No Images',
        'Is chamber ke liye koi image available nahi hai.',
      );
      return;
    }
    setImageViewer({
      visible: true,
      images: item.images,
      chamberId: item.chamberId,
      routeId: item.routeId,
      routeName: item.routeName,
    });
  }, []);
  const closeImageViewer = useCallback(() => {
    setImageViewer(prev => ({...prev, visible: false}));
  }, []);
  return (
    <Screen statusBarStyle="dark-content" statusBgColor={COLORS.PRIMARY}>
      <View style={styles.body}>
        <View style={[styles.header, {paddingTop: insets.top + 12}]}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            style={styles.backBtn}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.arrowBack}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Chamber Maintenance
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
            onUserLocationChange={e => {
              const coords = e?.nativeEvent?.coordinate;
              if (coords) setUserLocation(coords);
            }}
            showsUserLocation
            showsMyLocationButton={false}>
            {chambersWithDistance.map(item => (
              <Marker
                key={item.id}
                coordinate={{latitude: item.lat, longitude: item.long}}
                pinColor={
                  item.id === nearestChamberId
                    ? 'green'
                    : item.outOfRange
                    ? COLORS.colorRed
                    : COLORS.PRIMARY
                }
              />
            ))}
          </MapView>
          {/* <TouchableOpacity style={styles.expandBtn} onPress={handleExpandMap}>
            <Image
              style={styles.expandIcon}
              resizeMode="contain"
              source={IMAGES.expandIcon}
            /> */}
          {/* </TouchableOpacity> */}
        </View>
        <View style={[styles.inner, styles.div2Layout]}>
          <View style={[styles.row, styles.rowFlexBox]}>
            <View style={[styles.col, styles.colFlexBox]}>
              <View style={[styles.filter, styles.listLayout]}>
                <View style={[styles.span, styles.spanFlexBox]}>
                  <Image
                    style={styles.vectorIcon}
                    resizeMode="cover"
                    source={IMAGES.search}
                  />
                  <TextInput
                    style={[styles.filterText, styles.distanceTypo]}
                    placeholder="Search"
                    placeholderTextColor={COLORS.colorSlategray}
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                </View>
                {searchText.length > 0 && (
                  <TouchableOpacity
                    style={[styles.plus, styles.plusBg]}
                    onPress={() => setSearchText('')}>
                    <Image
                      style={styles.vectorIcon2}
                      resizeMode="cover"
                      source={IMAGES.close}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.col2}>
              <View style={[styles.filter, styles.listLayout]}>
                <TouchableOpacity
                  style={[styles.plus, styles.plusBg]}
                  onPress={decreaseRadius}
                  disabled={radiusM <= MIN_RADIUS_M}>
                  <Image
                    style={styles.vectorIcon3}
                    resizeMode="cover"
                    source={IMAGES.minusIcon}
                  />
                </TouchableOpacity>
                <Text style={[styles.filterText2, styles.filterTypo]}>
                  {radiusM}m
                </Text>
                <TouchableOpacity
                  style={[styles.plus, styles.plusBg]}
                  onPress={increaseRadius}
                  disabled={radiusM >= MAX_RADIUS_M}>
                  <Image
                    style={styles.vectorIcon4}
                    resizeMode="cover"
                    source={IMAGES.plus}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.formBody}>
            {assignedChamberComplaintsLoading && !refreshing ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              </View>
            ) : (
              <ScrollView
                ref={scrollViewRef}
                style={[styles.list, styles.listLayout]}
                contentContainerStyle={styles.listContainerContentVertical}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[COLORS.PRIMARY]}
                  />
                }>
                {chambersWithDistance.length > 0 ? (
                  <View style={styles.pitListContainer}>
                    <View style={styles.dashLineCol} pointerEvents="none">
                      <VerticalDashedLineAutoHeight
                        left={DASH_COL_WIDTH / 2 - DASH_W / 2}
                        color={COLORS.colorDimgray ?? '#888'}
                        opacity={0.5}
                      />
                      {nearestChamberId &&
                        (() => {
                          const pinTop = getPinTop();
                          if (pinTop < 0) return null;
                          return (
                            <View
                              style={[styles.pinMarkerAbs, {top: pinTop}]}
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
                    <View style={styles.chamberListCol}>
                      {chambersWithDistance.map(item => {
                        const isCompleted = isCompletedStatus(item.status);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            activeOpacity={isCompleted ? 1 : 0.8}
                            disabled={isCompleted}
                            style={[
                              styles.li,
                              item.id === nearestChamberId && styles.liNearest,
                            ]}
                            onPress={() => handleCardPress(item)}
                            onLayout={e =>
                              handleCardLayout(
                                item.id,
                                e.nativeEvent.layout.height,
                              )
                            }>
                            {item.id === nearestChamberId && (
                              <View style={styles.nearestTag}>
                                <Text style={styles.nearestTagText}>
                                  📍 Nearest to you
                                </Text>
                              </View>
                            )}
                            <View style={styles.rowalign}>
                              <View style={{}}>
                                <Image
                                  style={{
                                    width: 30,
                                    height: 30,
                                    resizeMode: 'contain',
                                  }}
                                  source={IMAGES.chamberNew}
                                />
                              </View>
                              <View style={styles.cardInfoColumn}>
                                <View style={styles.topInfoRow}>
                                  <Text
                                    style={styles.complaintNoText}
                                    numberOfLines={1}>
                                    {item.complaintNo}
                                  </Text>
                                  <Text
                                    style={styles.zoneText}
                                    numberOfLines={1}>
                                    Zone: {item.zone}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.statusTxt,
                                      {
                                        backgroundColor: isCompleted
                                          ? COLORS.SUCCESS
                                          : COLORS.WARNING,
                                      },
                                    ]}
                                    numberOfLines={1}>
                                    {item.status
                                      ? item.status.charAt(0).toUpperCase() +
                                        item.status.slice(1).toLowerCase()
                                      : ''}
                                  </Text>
                                </View>
                                <View style={styles.pt015084Parent}>
                                  <Text
                                    style={{
                                      fontSize: SIZE.MS(12),
                                      fontFamily: FONTS.SEMI_BOLD,
                                      color: COLORS.BLACK,
                                    }}>
                                    Task Type :-
                                    <Text
                                      style={{
                                        color: COLORS.BLACK,
                                        fontFamily: FONTS.MEDIUM,
                                      }}>
                                      {item.typeOfWork}
                                    </Text>
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.li2}>
                              <View style={[styles.col3, styles.rowFlexBox]}>
                                <Text
                                  style={[
                                    styles.fullAddress,
                                    styles.landmarkTypo,
                                  ]}>
                                  <Text style={styles.addressTypo}>
                                    Route :-
                                  </Text>
                                  <Text style={styles.nearAlaknandaMarket}>
                                    {item?.routeId}({item.routeName})
                                  </Text>
                                </Text>
                                <Text
                                  style={[
                                    styles.fullAddress,
                                    styles.landmarkTypo,
                                  ]}>
                                  <Text style={styles.addressTypo}>
                                    Chamber:
                                  </Text>
                                  <Text style={styles.nearAlaknandaMarket}>
                                    {item.chamberId} ({item.chamberName})
                                  </Text>
                                </Text>
                                <Text
                                  style={[
                                    styles.fullAddress,
                                    styles.landmarkTypo,
                                  ]}>
                                  <Text style={styles.addressTypo}>
                                    Chamber Address:-
                                  </Text>
                                  <Text style={styles.nearAlaknandaMarket}>
                                    {item.address}
                                  </Text>
                                </Text>
                                <View style={styles.latlong}>
                                  <View style={styles.col4}>
                                    <View style={styles.control}>
                                      <Text style={styles.text2Typo}>Lat:</Text>
                                      <Text style={styles.text2Typo}>
                                        {item.lat}°
                                      </Text>
                                    </View>
                                    <View style={styles.control}>
                                      <Text style={styles.text2Typo}>
                                        Long:
                                      </Text>
                                      <Text style={styles.text2Typo}>
                                        {item.long}°
                                      </Text>
                                    </View>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.control}
                                    activeOpacity={0.7}
                                    hitSlop={{
                                      top: 8,
                                      bottom: 8,
                                      left: 8,
                                      right: 8,
                                    }}
                                    onPress={() => handleViewImages(item)}>
                                    <Text
                                      style={[styles.text2, styles.text2Typo]}>
                                      View Images
                                      {item.images.length > 0
                                        ? ` (${item.images.length})`
                                        : ''}
                                    </Text>
                                    <Image
                                      style={styles.imgIcon}
                                      resizeMode="contain"
                                      source={IMAGES.galleryIcon}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.control}
                                    activeOpacity={0.7}
                                    hitSlop={{
                                      top: 8,
                                      bottom: 8,
                                      left: 8,
                                      right: 8,
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Navigate to chamber"
                                    onPress={() =>
                                      Common.openMaps(item.lat, item.long)
                                    }>
                                    <Image
                                      style={styles.imgIcon}
                                      resizeMode="contain"
                                      source={IMAGES.GoogleMapsIcon}
                                    />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    No chambers found nearby.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.whereIAmBtn}
          activeOpacity={0.85}
          onPress={handleWhereIAm}>
          <Text style={styles.whereIAmText}>Where I am?</Text>
        </TouchableOpacity>
      </View>

      {/* ── Images bottom sheet ──────────────────────────────────────── */}
      <Modal
        visible={imageViewer.visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeImageViewer}>
        <View style={styles.sheetBackdrop}>
          {/* Tap outside the sheet to close */}
          <TouchableWithoutFeedback onPress={closeImageViewer}>
            <View style={styles.sheetDismissArea} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.sheet,
              {paddingBottom: Math.max(insets.bottom, 12) + 4},
            ]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetMetadata}>
              <Text style={styles.sheetTitle}>
                Chamber ID:{'\n'}
                <Text
                  style={{fontSize: SIZE.MS(15), fontFamily: FONTS.SEMI_BOLD}}>
                  {imageViewer.chamberId || '—'}
                </Text>
              </Text>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetGrid}
              showsVerticalScrollIndicator={false}>
              {imageViewer.images.map((uri, i) => (
                <GridImage key={`${uri}-${i}`} uri={uri} />
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetCloseBtn}
              activeOpacity={0.85}
              onPress={closeImageViewer}>
              <Text style={styles.sheetCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

export default ChamberMaintenanceScreen;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    width: '100%',
  },
  header: {
    gap: Gap.gap_12,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 48,
    paddingHorizontal: Padding.padding_16,
    paddingBottom: 12,
    backgroundColor: COLORS.colorWhite,
    zIndex: 10,
    elevation: 10,
  },
  backBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.fs_16,
    fontWeight: '700',
    fontFamily: FONTS.MEDIUM,
    color: COLORS.BLACK,
    textAlign: 'left',
  },
  headerRightSpacer: {
    width: 28,
  },
  mapWrapper: {
    width: '94%',
    height: SIZE.MS(190),
    marginBottom: 12,
    alignSelf: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  expandBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: Border.br_6,
    backgroundColor: COLORS.colorWhite,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    // boxShadow: BoxShadow.shadow_drop,  <- hata do (elevation ke saath double shadow aa raha tha)
  },
  expandIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.BLACK, // ya COLORS.PRIMARY
  },
  listContainerContentVertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    // Makes the row holding the dashed line + cards fill at least the full
    // visible list area so the line reaches down near "Where I am?".
    flexGrow: 1,
  },
  loaderWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pitListContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    flexGrow: 1,
  },
  dashLineCol: {
    width: DASH_COL_WIDTH,
    position: 'relative',
    marginRight: 6,
    // Keeps the line above the elevated cards on Android.
    zIndex: 1,
    elevation: 4,
  },
  chamberListCol: {
    flex: 1,
    flexDirection: 'column',
    gap: CARD_GAP,
  },
  pinMarkerAbs: {
    position: 'absolute',
    right: -25,
    width: DASH_COL_WIDTH + 44,
    alignItems: 'center',
    zIndex: 2,
    elevation: 2,
  },
  locationCheckIcon: {
    height: 20,
    width: 20,
  },
  distanceAwayText: {
    marginTop: 2,
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.MEDIUM,
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
    marginBottom: 6,
  },
  nearestTagText: {
    fontSize: FontSize.fs_10,
    color: COLORS.SUCCESS ?? '#3EC21E',
    fontFamily: FONTS.MEDIUM,
    fontWeight: '600',
  },
  liNearest: {
    borderWidth: 1.5,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
  },
  div2Layout: {
    width: '100%',
    flex: 1,
  },
  rowFlexBox: {
    gap: Gap.gap_6,
    alignSelf: 'stretch',
  },
  colFlexBox: {
    paddingBottom: Padding.padding_4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Border.br_6,
    flexDirection: 'row',
  },
  listLayout: {
    maxWidth: '100%',
    flex: 1,
  },
  spanFlexBox: {
    gap: Gap.gap_10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  plusBg: {
    backgroundColor: 'transparent',
    borderRadius: Border.br_5,
  },
  filterTypo: {
    fontSize: 13,
    flex: 1,
  },
  landmarkTypo: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  pt015084Typo: {
    fontWeight: '500',
    lineHeight: LineHeight.lh_17,
    fontSize: FontSize.fs_10,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  addressTypo: {
    fontWeight: '600',
    fontFamily: FONTS.SEMI_BOLD,
  },
  text2Typo: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_10,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 0,
    gap: 12,
    alignItems: 'flex-start',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    paddingLeft: 12,
    paddingTop: Padding.padding_4,
    paddingRight: Padding.padding_4,
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_6,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    flex: 1,
  },
  filter: {
    gap: Gap.gap_2,
    alignItems: 'center',
    flexDirection: 'row',
  },
  span: {
    alignItems: 'center',
    flex: 1,
  },
  vectorIcon: {
    height: 13.5,
    width: 13.5,
  },
  filterText: {
    color: COLORS.colorSlategray,
    opacity: 1,
    fontSize: 13,
    flex: 1,
    padding: 4,
  },
  plus: {
    height: 25,
    width: 25,
    borderWidth: 1,
    borderColor: 'transparent',
    borderStyle: 'solid',
    justifyContent: 'center',
    overflow: 'hidden',
    alignItems: 'center',
  },
  vectorIcon2: {
    width: SIZE.MS(9),
    height: SIZE.MS(9),
    tintColor: 'red',
  },
  col2: {
    width: 109,
    padding: Padding.padding_4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_6,
    flexDirection: 'row',

    // Android shadow
    elevation: 3,

    // iOS shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  vectorIcon3: {
    width: SIZE.MS(11.5),
    height: SIZE.MS(1.5),
  },
  filterText2: {
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  vectorIcon4: {
    width: 12,
    height: 12,
  },
  formBody: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    flex: 1,
  },
  list: {
    alignSelf: 'stretch',
  },
  li: {
    borderRadius: Border.br_8,
    padding: Padding.padding_8,
    backgroundColor: COLORS.colorWhite,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    alignItems: 'flex-start',
    width: '100%',
  },
  pt015084Parent: {
    gap: Gap.gap_5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  pt015084: {
    opacity: Opacity.opacity_0_7,
    color: COLORS.colorDarkslategray,
  },
  needChamberRcc: {
    color: COLORS.colorDarkorange,
  },
  li2: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  col3: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  landmarkLabel: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  fullAddress: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  nearAlaknandaMarket: {
    fontFamily: FONTS.MEDIUM,
  },
  landmarkLabel2: {
    alignSelf: 'stretch',
  },
  latlong: {
    height: Height.height_17,
    gap: Gap.gap_4,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  col4: {
    gap: Gap.gap_4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  control: {
    gap: Gap.gap_4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  text2: {
    textDecorationLine: 'underline',
  },
  imgIcon: {
    width: 17,
    height: Height.height_17,
  },
  inlineDistanceRow: {
    marginTop: Padding.padding_4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_3,
    alignSelf: 'flex-start',
  },
  distance: {
    fontSize: FontSize.fs_11,
    lineHeight: LineHeight.lh_12,
    color: COLORS.colorDarkslategray,
  },
  vectorIcon5: {
    height: 10.91,
    width: 5.2,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: FONTS.MEDIUM,
    fontSize: FontSize.fs_12,
    color: COLORS.colorSlategray,
    paddingVertical: 24,
  },
  whereIAmBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    height: 48,
    borderRadius: Border.br_8,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whereIAmText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_14,
    fontWeight: '600',
    fontFamily: FONTS.MEDIUM,
  },
  rowalign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topInfoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfoColumn: {
    flex: 1,
    minWidth: 0,
    marginLeft: SIZE.MS(10),
  },
  complaintNoText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.SEMI_BOLD,
    flexShrink: 1,
  },
  zoneText: {
    marginLeft: SIZE.MS(6),
    fontSize: SIZE.MS(9),
    color: '#426eff',
    fontFamily: FONTS.REGULAR,
    flexShrink: 1,
  },
  statusTxt: {
    marginLeft: 'auto',
    fontSize: SIZE.MS(8),
    backgroundColor: COLORS.WARNING,
    paddingVertical: SIZE.MS(4),
    paddingHorizontal: SIZE.MS(6),
    borderRadius: SIZE.MS(6),
    color: COLORS.WHITE,
    flexShrink: 0,
  },
  // ── Images bottom sheet ───────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: SCREEN_H * 0.85,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: SHEET_PADDING,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9CCD1',
    marginBottom: 14,
  },
  sheetTitle: {
    // textAlign: 'left',
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.BLACK,
  },
  sheetMetadata: {
    // alignItems: 'center',
    marginBottom: 14,
    gap: 4,
  },
  sheetMetadataText: {
    textAlign: 'center',
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.BLACK,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingBottom: 4,
  },
  gridTile: {
    width: GRID_TILE_W,
    height: GRID_TILE_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F0F1F3',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridError: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridErrorText: {
    fontSize: 11,
    color: '#8A8F98',
    fontFamily: FONTS.MEDIUM,
  },
  sheetCloseBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.MEDIUM,
  },
});
