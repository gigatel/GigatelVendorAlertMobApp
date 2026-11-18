import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ImageSourcePropType,
  useWindowDimensions,
  LayoutRectangle,
  Alert,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  PERMISSIONS,
  RESULTS,
  request,
  requestMultiple,
} from 'react-native-permissions';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@reducers';
import {
  getEmployeeTaskAPI,
  GetEmployeeTaskParams,
} from '@slices/maintenance.slice';
import MapView, {LatLng, Marker, PROVIDER_GOOGLE, Region} from 'react-native-maps';
import {Screen} from '@organisms';
import {ScreenProps} from '@types';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {FontFamily, Padding} from '../../res/globalStyle';
type Role = 'Patroller' | 'Driver' | 'Supervisor' | 'Splicer' | 'Manager';
type RoleFilter = 'All' | Role;
interface Employee {
  id: string;
  code: string;
  name: string;
  role: string;
  shift: string;
  deviceCode: string; // UI-4-GPS-86
  mobileOn: boolean;
  vehicleOn: boolean;
  coordinate: {latitude: number; longitude: number} | null;
}
const ROLES: RoleFilter[] = [
  'All',
  'Patroller',
  'Driver',
  'Supervisor',
  'Splicer',
  'Manager',
];
const INITIAL_REGION: Region = {
  latitude: 28.5845,
  longitude: 77.3295,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
const EMPLOYEE_TASK_BODY: GetEmployeeTaskParams = {
  departmentId: '',
  designationId: '',
  employeeId: '',
  zoneId: '',
  shiftId: '',
  search: '',
  page: 1,
  size: 100,
};
// Temporary request values: replace these with the selected employee filters later.
// const EMPLOYEE_TASK_BODY: GetEmployeeTaskParams = {
//   departmentId: '21',
//   designationId: '58',
//   employeeId: '500',
//   zoneId: '85',
//   shiftId: '13',
//   search: 'GT0121',
//   page: 1,
//   size: 100,
// };

const isStatusOn = (value: unknown) =>
  value === true ||
  ['1', 'true', 'on', 'online'].includes(String(value).toLowerCase());

// Keep response field mapping here so backend field changes have one edit point.
const mapEmployee = (
  item: Record<string, unknown>,
  index: number,
): Employee => {
  const lat = item.latitude ?? item.lat;
  const lng = item.longitude ?? item.lng ?? item.long;
  const latitude = Number(lat);
  const longitude = Number(lng);
  const hasCoordinate =
    lat != null &&
    lng != null &&
    String(lat).trim() !== '' &&
    String(lng).trim() !== '' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  return {
    id: String(item.employeeId ?? item.id ?? item.employeeCode ?? index),
    code: String(item.employeeCode ?? item.employeeId ?? item.id ?? ''),
    name: String(item.employeeName ?? item.name ?? ''),
    role: String(item.designationName ?? item.role ?? ''),
    shift: String(item.shiftName ?? item.shift ?? ''),
    deviceCode: String(
      item.deviceCode ??
        item.imei ??
        item.vehicleNumber ??
        item.vehicleNo ??
        '',
    ),
    mobileOn: isStatusOn(
      item.mobileOn ?? item.mobileStatus ?? item.powerStatus ?? item.gpsStatus,
    ),
    vehicleOn: isStatusOn(
      item.vehicleOn ?? item.vehicleStatus ?? item.ignitionOn,
    ),
    coordinate: hasCoordinate ? {latitude, longitude} : null,
  };
};
const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

const EmployeeVehicleScreen: FC<ScreenProps.EmployeeVehicleScreen> = ({
  navigation,
  loading,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const currentLocationMarkerRef = useRef<Marker>(null);
  const showLocationCalloutRef = useRef(false);
  const regionRef = useRef<Region>(INITIAL_REGION);
  const locatingRef = useRef(false);
  const shouldFitEmployeesRef = useRef(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<RoleFilter>('All');
  const [showMobile, setShowMobile] = useState(true);
  const [showVehicle, setShowVehicle] = useState(true);
  const [showDay, setShowDay] = useState(true);
  const [showNight, setShowNight] = useState(true);
  const [shiftOpen, setShiftOpen] = useState(false); // main screen dropdown
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetShiftOpen, setSheetShiftOpen] = useState(false); // sheet dropdown
  const [sheetChipsLayout, setSheetChipsLayout] =
    useState<LayoutRectangle | null>(null);
  const [data, setData] = useState<Employee[]>([]);

  // Shift chip highlighted when the filter is narrowed (not "all")
  const shiftFiltered = showDay !== showNight;

  const {filtered, modalFiltered} = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchingEmployees = data.filter(item => {
      if (selectedId && item.id !== selectedId) return false;
      if (item.shift.toLowerCase().includes('day') && !showDay) return false;
      if (item.shift.toLowerCase().includes('night') && !showNight)
        return false;
      if (
        q &&
        !`${item.code} ${item.name} ${item.deviceCode}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
    const filteredEmployees = matchingEmployees.filter(
      item =>
        activeRole === 'All' ||
        item.role.trim().toLowerCase() === activeRole.toLowerCase(),
    );
    return {
      filtered: filteredEmployees,
      modalFiltered:
        activeRole === 'Splicer'
          ? matchingEmployees.filter(item =>
              ['splicer', 'senior splicer', 'junior splicer'].includes(
                item.role.trim().toLowerCase(),
              ),
            )
          : filteredEmployees,
    };
  }, [data, search, selectedId, activeRole, showDay, showNight]);

  // Let image markers draw once, then stop tracking view changes (perf)
  const [trackMarkers, setTrackMarkers] = useState(true);
  useEffect(() => {
    setTrackMarkers(true);
    const t = setTimeout(() => setTrackMarkers(false), 800);
    return () => clearTimeout(t);
  }, [filtered, showMobile, showVehicle, mapReady]);

  const selectedEmployee = useMemo(
    () => data.find(e => e.id === selectedId) || null,
    [data, selectedId],
  );

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await dispatch(
        getEmployeeTaskAPI(EMPLOYEE_TASK_BODY),
      ).unwrap();
      // The thunk unwraps data, which contains the employees array.
      const rows = Array.isArray(response)
        ? response
        : response?.employees ?? response?.items;
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected employee tracking response');
      }
      const employees = rows
        .filter(item => item && typeof item === 'object')
        .map(mapEmployee);
      setData(employees);
      setSelectedId(id =>
        employees.some(employee => employee.id === id) ? id : null,
      );
    } catch (err: unknown) {
      setFetchError(
        err instanceof Error
          ? err.message
          : String(err || 'Unable to fetch employee tracking'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (!shouldFitEmployeesRef.current || !mapReady) {
      return;
    }
    const coordinates = data.flatMap(employee =>
      employee.coordinate ? [employee.coordinate] : [],
    );
    if (coordinates.length && mapRef.current) {
      shouldFitEmployeesRef.current = false;
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: {top: 200, right: 60, bottom: 100, left: 60},
        animated: true,
      });
    }
  }, [data, mapReady]);

  const onRefresh = () => {
    // Refresh marker data without changing the current map position or zoom.
    shouldFitEmployeesRef.current = false;
    fetchEmployees();
  };

  const onLocationMe = async () => {
    if (locatingRef.current || !mapReady) {
      return;
    }
    locatingRef.current = true;
    setIsLocating(true);
    try {
      let permissionGranted: boolean;
      if (Platform.OS === 'android') {
        const statuses = await requestMultiple([
          PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]);
        permissionGranted =
          statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED ||
          statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION] === RESULTS.GRANTED;
      } else {
        permissionGranted =
          (await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)) === RESULTS.GRANTED;
      }
      if (!permissionGranted) {
        Alert.alert(
          'Location permission required',
          'Allow location access in app settings to show your current location.',
        );
        return;
      }
      const coordinate = await new Promise<LatLng>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position => {
            const {latitude, longitude} = position.coords;
            resolve({latitude, longitude});
          },
          reject,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
            showLocationDialog: true,
          },
        );
      });
      shouldFitEmployeesRef.current = false;
      setCurrentLocation(coordinate);
      showLocationCalloutRef.current = true;
      mapRef.current?.animateToRegion(
        {...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01},
        400,
      );
    } catch {
      Alert.alert(
        'Unable to get location',
        'Please enable location services and try Location Me again.',
      );
    } finally {
      locatingRef.current = false;
      setIsLocating(false);
    }
  };

  const zoom = (factor: number) => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        ...r,
        latitudeDelta: r.latitudeDelta * factor,
        longitudeDelta: r.longitudeDelta * factor,
      },
      250,
    );
  };

  const openSheet = () => {
    setShiftOpen(false);
    setSheetShiftOpen(false);
    setSheetVisible(true);
  };

  const closeSheet = () => {
    setSheetShiftOpen(false);
    setSheetVisible(false);
  };

  const clearSearch = () => {
    setSearch('');
    setSelectedId(null);
  };

  const onSelectEmployee = (emp: Employee) => {
    setSelectedId(emp.id);
    setSearch('');
    closeSheet();
    if (!emp.coordinate) return;
    mapRef.current?.animateToRegion(
      {
        ...emp.coordinate,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500,
    );
  };

  const renderMarker = (emp: Employee, kind: 'Mobile' | 'Vehicle') => {
    if (!emp.coordinate) return null;
    const on = kind === 'Mobile' ? emp.mobileOn : emp.vehicleOn;
    return (
      <Marker
        key={`${emp.id}-${kind}`}
        coordinate={emp.coordinate}
        anchor={{x: 0.5, y: 1}}
        centerOffset={{
          x: showMobile && showVehicle ? (kind === 'Mobile' ? -18 : 18) : 0,
          y: 0,
        }}
        title={`${emp.code} - ${emp.name}`}
        description={`${emp.role} • ${kind}: ${on ? 'On' : 'Off'}`}
        tracksViewChanges={trackMarkers}>
        <View style={styles.markerWrap}>
          {(kind === 'Mobile' || !showMobile) && (
            <View
              style={[
                styles.markerLabel,
                {backgroundColor: on ? '#1E7B4A' : '#D93A2B'},
              ]}>
              <Text style={styles.markerLabelText} numberOfLines={1}>
                {emp.code} - {emp.name} - {emp.role}
              </Text>
            </View>
          )}
          <Image
            style={
              kind === 'Mobile' ? styles.markerMobileImg : styles.markerBikeImg
            }
            resizeMode="contain"
            source={kind === 'Mobile' ? IMAGES.mobileNew : IMAGES.bikeNew}
          />
        </View>
      </Marker>
    );
  };

  const renderCheckbox = (
    label: string,
    checked: boolean,
    onToggle: () => void,
  ) => (
    <Pressable key={label} style={styles.checkRow} onPress={onToggle}>
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
        {checked && <Text style={styles.checkTick}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );

  const renderStatus = (
    icon: ImageSourcePropType,
    label: string,
    on: boolean,
  ) => (
    <View style={styles.statusRow}>
      <Image style={styles.statusIcon} resizeMode="contain" source={icon} />
      <Text style={styles.statusLabel}>{label}</Text>
      <View
        style={[styles.badge, {backgroundColor: on ? '#16A34A' : '#DC2626'}]}>
        <Text style={styles.badgeText}>{on ? 'On' : 'Off'}</Text>
      </View>
    </View>
  );

  const renderEmployeeRow = ({item}: {item: Employee}) => (
    <Pressable style={styles.empRow} onPress={() => onSelectEmployee(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.empInfo}>
        <Text style={styles.empTitle} numberOfLines={1}>
          {item.code} · {item.name}
        </Text>
        <Text style={styles.empSub} numberOfLines={1}>
          {item.role} • {item.deviceCode}
        </Text>
      </View>
      <View style={styles.empStatus}>
        {renderStatus(IMAGES.mobileNew, 'Mobile', item.mobileOn)}
        {renderStatus(IMAGES.bikeNew, 'Vehicle', item.vehicleOn)}
      </View>
    </Pressable>
  );

  const mainSearchLabel = selectedEmployee
    ? `${selectedEmployee.code} · ${selectedEmployee.name}`
    : search;

  return (
    <Screen
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      loading={isLoading || loading}
      preset="fixed"
      statusBarStyle="dark">
      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.back}
            />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            Employee Vehicle / Mobile Tracking
          </Text>
          <View style={styles.rightPlaceholder} />
        </View>

        {/* Map card */}
        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={INITIAL_REGION}
            onMapReady={() => setMapReady(true)}
            onRegionChangeComplete={r => {
              regionRef.current = r;
              if (
                showLocationCalloutRef.current &&
                currentLocationMarkerRef.current
              ) {
                currentLocationMarkerRef.current.showCallout();
                showLocationCalloutRef.current = false;
              }
            }}
            onPress={() => setShiftOpen(false)}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            zoomControlEnabled={false}>
            {currentLocation && (
              <Marker
                ref={currentLocationMarkerRef}
                key="my-current-location"
                coordinate={currentLocation}
                title="My Current Location"
                pinColor="#2563EB"
              />
            )}
            {filtered.map(emp => [
              showMobile ? renderMarker(emp, 'Mobile') : null,
              showVehicle ? renderMarker(emp, 'Vehicle') : null,
            ])}
          </MapView>

          {/* Top overlay: search + filters + checkboxes */}
          <View style={styles.topOverlay} pointerEvents="box-none">
            {fetchError && (
              <Text style={styles.emptyText}>
                {fetchError}. Tap Refresh to retry.
              </Text>
            )}
            {/* Tapping the search box opens the bottom sheet */}
            <Pressable style={styles.searchBox} onPress={openSheet}>
              <Text style={styles.searchIcon}>🔍</Text>
              <Text
                style={[
                  styles.searchInput,
                  !mainSearchLabel && styles.searchPlaceholder,
                ]}
                numberOfLines={1}>
                {mainSearchLabel || 'Search vehicle...'}
              </Text>
              <Pressable
                style={styles.clearBtn}
                hitSlop={8}
                onPress={clearSearch}>
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              {ROLES.map(role => {
                const active = activeRole === role;
                return (
                  <Pressable
                    key={role}
                    accessibilityRole="button"
                    accessibilityState={{selected: active}}
                    onPress={() => {
                      setShiftOpen(false);
                      setActiveRole(active ? 'All' : role);
                    }}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}>
                      {role}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setShiftOpen(v => !v)}
                style={[
                  styles.chip,
                  styles.shiftChip,
                  (shiftOpen || shiftFiltered) && styles.chipActive,
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    (shiftOpen || shiftFiltered) && styles.chipTextActive,
                  ]}>
                  Shift
                </Text>
                <Text
                  style={[
                    styles.chevron,
                    (shiftOpen || shiftFiltered) && styles.chipTextActive,
                  ]}>
                  {shiftOpen ? '⌃' : '⌄'}
                </Text>
              </Pressable>
            </ScrollView>

            <View style={styles.cardsRow} pointerEvents="box-none">
              {/* Mobile / Vehicle */}
              <View style={styles.checkCard}>
                {renderCheckbox('Mobile', showMobile, () =>
                  setShowMobile(v => !v),
                )}
                {renderCheckbox('Vehicle', showVehicle, () =>
                  setShowVehicle(v => !v),
                )}
              </View>

              {/* Shift dropdown (Day / Night) */}
              {shiftOpen && (
                <View style={styles.checkCard}>
                  {renderCheckbox('Day', showDay, () => setShowDay(v => !v))}
                  {renderCheckbox('Night', showNight, () =>
                    setShowNight(v => !v),
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Bottom overlay: refresh, location, zoom */}
          <View style={styles.bottomOverlay} pointerEvents="box-none">
            <View style={styles.bottomPill}>
              <Pressable style={styles.pillBtn} onPress={onRefresh}>
                <Text style={styles.pillIcon}>↻</Text>
                <Text style={styles.pillText}>Refresh</Text>
              </Pressable>
              <View style={styles.pillDivider} />
              <Pressable
                style={styles.pillBtn}
                onPress={onLocationMe}
                disabled={isLocating || !mapReady}
                accessibilityRole="button"
                accessibilityLabel="Location Me"
                accessibilityState={{
                  disabled: isLocating || !mapReady,
                  busy: isLocating,
                }}>
                <Text style={styles.pillIcon}>◎</Text>
                <Text style={styles.pillText}>
                  {isLocating ? 'Locating...' : 'Location Me'}
                </Text>
              </Pressable>
              <View style={styles.pillDivider} />
              <Pressable style={styles.zoomBtn} onPress={() => zoom(2)}>
                <Text style={styles.zoomText}>−</Text>
              </Pressable>
              <Pressable style={styles.zoomBtn} onPress={() => zoom(0.5)}>
                <Text style={styles.zoomText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Search Vehicles bottom sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={closeSheet} />

          <View
            style={[
              styles.sheet,
              {
                height: windowHeight * 0.85,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}>
            <Pressable
              style={styles.handleButton}
              onPress={closeSheet}
              accessibilityRole="button"
              accessibilityLabel="Close employee search">
              <View style={styles.handle} />
            </Pressable>

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Search Vehicles</Text>
              <Text style={styles.sheetCount}>
                {modalFiltered.length} Vehicles
              </Text>
            </View>

            <View style={styles.sheetSearch}>
              <View style={styles.sheetSearchIcon}>
                <View style={styles.searchLens} />
                <View style={styles.searchStem} />
              </View>
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search vehicle..."
                placeholderTextColor="#8A8F98"
                value={search}
                onChangeText={t => {
                  setSelectedId(null);
                  setSearch(t);
                }}
                onFocus={() => setSheetShiftOpen(false)}
                autoCorrect={false}
              />
            </View>

            <View
              style={styles.sheetChips}
              onLayout={e => setSheetChipsLayout(e.nativeEvent.layout)}>
              <View style={styles.sheetChipsLeft}>
                {ROLES.map(role => {
                  const active = activeRole === role;
                  return (
                    <Pressable
                      key={role}
                      accessibilityRole="button"
                      accessibilityState={{selected: active}}
                      onPress={() => {
                        setSheetShiftOpen(false);
                        setActiveRole(active ? 'All' : role);
                      }}
                      style={[styles.sheetChip, active && styles.chipActive]}>
                      <Text
                        style={[
                          styles.sheetChipText,
                          active && styles.chipTextActive,
                        ]}>
                        {role}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => setSheetShiftOpen(v => !v)}
                style={[
                  styles.sheetChip,
                  styles.sheetShiftChip,
                  (sheetShiftOpen || shiftFiltered) && styles.chipActive,
                ]}>
                <Text
                  style={[
                    styles.sheetChipText,
                    (sheetShiftOpen || shiftFiltered) && styles.chipTextActive,
                  ]}>
                  Shift
                </Text>
                <Text
                  style={[
                    styles.chevron,
                    (sheetShiftOpen || shiftFiltered) && styles.chipTextActive,
                  ]}>
                  {sheetShiftOpen ? '⌃' : '⌄'}
                </Text>
              </Pressable>
            </View>

            <FlatList
              style={styles.list}
              data={modalFiltered}
              keyExtractor={item => item.id}
              renderItem={renderEmployeeRow}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {isLoading
                    ? 'Loading employees...'
                    : fetchError || 'No vehicles found'}
                </Text>
              }
              onScrollBeginDrag={() => setSheetShiftOpen(false)}
            />

            {/* Shift dropdown inside the sheet (Day / Night) */}
            {sheetShiftOpen && sheetChipsLayout && (
              <View
                style={[
                  styles.sheetShiftCard,
                  {top: sheetChipsLayout.y + sheetChipsLayout.height + 4},
                ]}>
                {renderCheckbox('Day', showDay, () => setShowDay(v => !v))}
                {renderCheckbox('Night', showNight, () =>
                  setShowNight(v => !v),
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
};

export default EmployeeVehicleScreen;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    width: '100%',
    paddingHorizontal: Padding.padding_16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {width: 24, height: 24},
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: SIZE.MS(14),
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
  },
  rightPlaceholder: {width: 40},

  mapCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },

  // top overlay
  topOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },
  searchIcon: {fontSize: 14, marginRight: 8, opacity: 0.6},
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    paddingVertical: 0,
  },
  searchPlaceholder: {color: '#8A8F98'},
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#2B2B2B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {color: '#FFF', fontSize: 12, fontWeight: '700'},

  chipRow: {gap: 8, paddingRight: 8},
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  chipActive: {backgroundColor: '#1D4ED8', borderColor: '#1D4ED8'},
  chipText: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  chipTextActive: {color: '#FFFFFF'},
  shiftChip: {gap: 14, paddingHorizontal: 14},
  chevron: {fontSize: 14, color: '#555', marginTop: -4},

  // Mobile/Vehicle card on the left, Shift dropdown card on the right
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  checkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    minWidth: 90,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  },
  checkRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9AA1AC',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkBoxChecked: {backgroundColor: '#1D4ED8', borderColor: '#1D4ED8'},
  checkTick: {color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: -1},
  checkLabel: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },

  // markers
  markerWrap: {alignItems: 'center'},
  markerLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    maxWidth: 190,
    marginBottom: 2,
  },
  markerLabelText: {color: '#FFF', fontSize: 8, fontWeight: '600'},
  markerBikeImg: {width: 32, height: 40},
  markerMobileImg: {width: 22, height: 36},

  // bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  bottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    height: 44,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: '100%',
  },
  pillIcon: {fontSize: 16, color: COLORS.colorDarkslategray},
  pillText: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  pillDivider: {width: 1, height: 22, backgroundColor: '#E4E7EC'},
  zoomBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {fontSize: 22, color: COLORS.colorDarkslategray, marginTop: -2},

  // ---------- Bottom sheet ----------
  modalRoot: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 16,
  },
  handleButton: {
    alignSelf: 'center',
    width: 72,
    height: 16,
    alignItems: 'center',
    paddingTop: 2,
  },
  handle: {
    width: 52,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#777777',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  sheetCount: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: FontFamily.switzer,
  },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    backgroundColor: '#F0F3F6',
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sheetSearchIcon: {
    width: 14,
    height: 16,
    marginRight: 7,
    justifyContent: 'center',
  },
  searchLens: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#98A2B3',
    borderRadius: 5,
  },
  searchStem: {
    position: 'absolute',
    width: 5,
    height: 1,
    backgroundColor: '#98A2B3',
    left: 8,
    top: 12,
    transform: [{rotate: '45deg'}],
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    paddingVertical: 0,
  },
  sheetChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetChipsLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    gap: 5,
  },
  sheetChip: {
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 14,
    backgroundColor: '#F0F3F6',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  sheetChipText: {
    fontSize: 10,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  sheetShiftChip: {gap: 6, paddingHorizontal: 10, marginLeft: 8},
  sheetShiftCard: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 7,
    gap: 8,
    minWidth: 100,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  list: {flex: 1},
  listContent: {paddingBottom: 12},
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
    color: '#8A8F98',
    fontFamily: FontFamily.switzer,
  },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F3F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '400',
    color: '#4B5563',
    fontFamily: FontFamily.switzer,
  },
  empInfo: {flex: 1, minWidth: 0},
  empTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  empSub: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 3,
    fontFamily: FontFamily.switzer,
  },
  empStatus: {gap: 3, width: 65},
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: 3},
  statusIcon: {width: 10, height: 10, tintColor: '#8C929A'},
  statusLabel: {
    fontSize: 8,
    color: '#6B7280',
    minWidth: 29,
    fontFamily: FontFamily.switzer,
  },
  badge: {
    minWidth: 18,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 6,
    alignItems: 'center',
  },
  badgeText: {color: '#FFF', fontSize: 7, fontWeight: '600'},
});
