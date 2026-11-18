import React, {
  FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StatusBar,
  Pressable,
  ScrollView,
  InteractionManager,
  Keyboard,
} from 'react-native';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import {RootState, AppDispatch} from '@reducers';
import {COLORS, IMAGES, SIZE} from '@res';
import {useDispatch, useSelector} from 'react-redux';
import {ticketService} from '../../../services/ticketService';
import {useRoute} from '@react-navigation/native';
import {width} from 'src/utils/common';
import {getChamberCorrectionListApi} from '@slices/chamber-correction.slice';
import {FontFamily, FontSize} from '../../../res/globalStyle';
import {Location} from '@utils';
import {FONTS} from '@res';
type PickerItem = {
  label: string;
  value: string;
  icon?: any;
  extra?: {
    chamberId?: string;
    chamberName?: string;
    distance?: number;
  };
  fullData?: any;
};

// Stable empty-array reference. Using `state.x || []` inline in a selector
// creates a BRAND NEW array every single render whenever the Redux value is
// falsy/undefined - this breaks the `useEffect` dependency below (it sees a
// "new" array every render even when nothing actually changed), causing the
// effect to re-run and re-set state repeatedly. That churn is what was
// showing up as the picker/list "fluctuating" on first load while GPS/API
// data was still resolving.
const EMPTY_CHAMBERS: any[] = [];

const TicketChamberReport: FC = ({navigation}: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const route = useRoute<any>();
  const {routeId, chamberNo} = route?.params;
  const routeIdInt = route?.params?.routeIdInt ?? null;
  const [searchText, setSearchText] = useState('');
  const [range, setRange] = useState('10000');
  const [currentLatLng, setCurrentLatLng] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('Select Nearest Chamber');
  const [selectedCircuit, setSelectedCircuit] = useState('');
  const [circuitList, setCircuitList] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const [showDistance, setShowDistance] = useState(false);

  // 👇 NEW: when the screen was opened with a routeId+chamberNo already
  // provided via navigation params, the chamber is "auto-selected" for the
  // user and the picker should be locked - tapping it must do nothing.
  // If the user later searches manually (handleSearch), we unlock it so
  // they can freely pick from search results.
  const [isLocked, setIsLocked] = useState(false);

  const nearestChambers = useSelector(
    (state: RootState) =>
      state.chamberCorrection?.correctionListData || EMPTY_CHAMBERS,
  );
  // Tracks a lightweight fingerprint of the last data we actually applied to
  // circuitList, so repeated effect firings (from GPS updates, background
  // watchPosition upgrades, etc.) don't blow away and rebuild state with an
  // "equal" list over and over, which is what was causing the visible
  // flicker at the bottom of the screen on first mount.
  const lastAppliedKeyRef = useRef<string | null>(null);

  /* ================= LOCATION ================= */
  const fetchCurrentLocation = async () => {
    try {
      const loc = await Location.getAddressFromLatLong();
      if (!loc?.lat || !loc?.long) {
        Alert.alert('Location Error', 'Unable to get current location');
        return;
      }
      const latlng = `${loc.lat},${loc.long}`;
      setCurrentLatLng(latlng);
      fetchNearestChambers(latlng, range);
    } catch {
      Alert.alert('Location Error', 'Please enable GPS');
    }
  };

  /* ================= FETCH NEAREST CHAMBERS ================= */
  const fetchNearestChambers = (latlng: string, rangeValue: string) => {
    dispatch(
      getChamberCorrectionListApi({
        latlng,
        labelType: 'Under Ground (GIG)',
        range: Number(rangeValue) || 100,
      }),
    );
  };

  /* ================= HANDLE RANGE CHANGE ================= */
  const handleRangeApply = () => {
    if (!currentLatLng) {
      Alert.alert('Error', 'Location not available');
      return;
    }
    if (!range || Number(range) <= 0) {
      Alert.alert('Invalid Range', 'Please enter a valid range');
      return;
    }
    fetchNearestChambers(currentLatLng, range);
  };

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  /* ================= FORMAT NEAREST CHAMBERS ================= */
  useEffect(() => {
    if (!nearestChambers.length) return;

    // Build a cheap fingerprint (ids + count) of the incoming data. If it's
    // identical to what we last applied, skip the state update entirely -
    // this stops redundant re-renders when the effect re-fires due to a new
    // (but equivalent) array reference from the selector/GPS updates.
    const fingerprint = `${nearestChambers.length}:${nearestChambers
      .map((c: any) => c.chamberNo)
      .join(',')}`;

    if (lastAppliedKeyRef.current === fingerprint) {
      return;
    }
    lastAppliedKeyRef.current = fingerprint;

    const formatted: PickerItem[] = nearestChambers.map((item: any) => ({
      label: item.chamberIdStr,
      value: String(item.chamberNo),
      icon: IMAGES.FiberEnclosur,
      fullData: {
        chamberNo: Number(item.chamberNo),
        routeIdInt: item.routeId,
      },
      extra: {
        chamberId: item.chamberIdStr,
        chamberName: item.chamberName,
        distance: item.distance,
      },
    }));

    setCircuitList(formatted);
    setShowDistance(true);

    // 👇 moved outside the .map() — this now runs once after formatted list is built
    if (chamberNo != null) {
      const match = formatted.find(i => i.value === String(chamberNo));
      if (match) {
        setSelectedLabel(match.extra?.chamberId || match.label);
      }
    }
  }, [nearestChambers, chamberNo]);

  /* ================= FETCH CHAMBER REPORT ================= */
  const fetchChamberReport = async (
    chamberNoVal: string,
    routeIdVal: string,
  ) => {
    setLoading(true);
    const res = await ticketService.getChamberReport(chamberNoVal, routeIdVal);
    setLoading(false);

    if (res.success) {
      setTableData(res.data);
    } else {
      setTableData([]);
    }
  };

  // 👇 Single reusable selection handler - used by the picker box, the
  // search-result picker, and (if wired up) any other selection entry
  // point. Fixes two bugs from before:
  //  1) Crash: some payloads carry `routeId` (raw search API objects)
  //     instead of `routeIdInt` (chamber-correction API mapping). We now
  //     fall back between both field names instead of assuming one.
  //  2) Silent no-op on 0: `if (chamberNo && routeId)` treated a valid
  //     value of 0 as falsy and skipped the fetch entirely. Switched to
  //     `!= null` checks so 0 is treated as a legitimate value.
  const handleChamberSelect = useCallback(async (item: PickerItem | any) => {
    setSelectedCircuit(item?.value ?? '');
    setSelectedLabel(
      item?.extra?.chamberId || item?.label || 'Select Nearest Chamber',
    );

    const chamberNoVal = item?.fullData?.chamberNo ?? null;
    const routeIdVal =
      item?.fullData?.routeIdInt ?? item?.fullData?.routeId ?? null;

    if (chamberNoVal == null || routeIdVal == null) {
      // Nothing usable to fetch with - bail out safely instead of crashing
      // on `.toString()` of undefined.
      return;
    }

    try {
      await fetchChamberReport(String(chamberNoVal), String(routeIdVal));
    } catch (e) {
      setLoading(false);
    }
  }, []);

  /* ================= SEARCH ================= */
  const handleSearch = async () => {
    if (!searchText.trim()) {
      return;
    }

    // Close keyboard first
    Keyboard.dismiss();

    // Wait for keyboard animation to finish
    setTimeout(async () => {
      try {
        setLoading(true);

        const res = await ticketService.getChamberNameListByName(
          searchText.trim(),
        );

        setLoading(false);

        if (!res.success) {
          return;
        }

        const formatted = res.data.map((item: any) => ({
          label: item.chamberId,
          value: item.chamberNo.toString(),
          icon: IMAGES.FiberEnclosur,
          fullData: item,
          extra: {
            chamberId: item.chamberId,
            chamberName: item.chamberName,
          },
        }));

        // 👇 A manual search means the user explicitly wants to pick a
        // different chamber, so unlock the picker even if it started out
        // auto-selected/locked from route params.
        setIsLocked(false);

        InteractionManager.runAfterInteractions(() => {
          navigation.navigate('CustomerPickerScreen', {
            data: formatted,
            selectedValue: '',
            title: 'Select Chamber',
            onSelect: async (item: any) => {
              await handleChamberSelect(item);
            },
          });
        });
      } catch (e) {
        setLoading(false);
      }
    }, 250);
  };

  /* ================= AUTO-SELECT FROM ROUTE PARAMS ================= */
  useEffect(() => {
    if (routeId != null && chamberNo != null) {
      setSelectedCircuit(String(chamberNo));
      setSelectedLabel(String(chamberNo));
      fetchChamberReport(String(chamberNo), String(routeId));
      // 👇 Lock the picker: this chamber was auto-selected from params,
      // tapping the box must not open the picker or change anything.
      setIsLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, chamberNo]);

  /* -----------------------------
            Picker Box
    ------------------------------ */
  const renderPickerBox = (
    label: string,
    value: string,
    list: PickerItem[],
    setValue: (v: string) => void,
    disabled: boolean,
  ) => {
    const selected = list.find(i => i.value === value);
    const displayLabel = selected?.extra?.chamberId
      ? `${selected.extra.chamberId}`
      : selected?.label || label;

    return (
      <Pressable
        style={[styles.box, disabled && styles.boxDisabled]}
        disabled={disabled}
        onPress={() => {
          if (disabled) {
            // Locked (auto-selected) chamber - do nothing on tap.
            return;
          }
          navigation.navigate('CustomerPickerScreen', {
            data: list,
            selectedValue: value,
            title: 'Select Chamber',
            onSelect: async (item: any) => {
              await handleChamberSelect(item);
            },
          });
        }}>
        <Text style={[styles.boxLabel, disabled && styles.boxLabelDisabled]}>
          {displayLabel}
        </Text>
        {!disabled && <Image source={IMAGES.down} style={styles.rightArrow} />}
      </Pressable>
    );
  };

  const renderTable = () => {
    if (tableData.length === 0) {
      return (
        <View>
          <Image
            source={IMAGES.noImage}
            style={styles.Iconnew}
            resizeMode="cover"
          />
          <View style={[styles.nodatafounddivnew, styles.ticketsParentFlexBox]}>
            <Text style={styles.noDataFound2}>No Data Found</Text>
          </View>
        </View>
      );
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableContainer}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={styles.headerCellSno}>S.No.</Text>
            <Text style={styles.headerCell}>CHAMBER ID</Text>
            <Text style={styles.headerCell}>CIRCUIT ID</Text>
            <Text style={styles.headerCell}>CUSTOMER</Text>
            <Text style={styles.headerCell}>ROUTE FROM</Text>
            <Text style={styles.headerCell}>TUBE FROM</Text>
            <Text style={styles.headerCell}>ROUTE TO</Text>
            <Text style={styles.headerCell}>TUBE TO</Text>
          </View>

          {/* Data Rows */}
          {tableData.map((item, index) => (
            <View key={index} style={styles.dataRow}>
              <Text style={styles.dataCellSno}>{index + 1}</Text>
              <Text style={styles.dataCell}>{item.chamber_id}</Text>
              <Text style={styles.dataCell}>{item.circuite_id}</Text>
              <Text style={styles.dataCell}>{item.customer_name}</Text>
              <Text style={styles.dataCell}>
                {item.route_name_from}({item.route_id_from})
              </Text>
              <Text style={styles.dataCell}>
                {item.tube_no_from} ({item.core_no1_from})
              </Text>
              <Text style={styles.dataCell}>
                {item.route_name_to}({item.route_id_to})
              </Text>
              <Text style={styles.dataCell}>
                {item.tube_no_to} ({item.core_no1_to})
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };
  // 👇 ADD HERE
  const selectedChamber = circuitList.find(
    item => item.value === selectedCircuit,
  );
  const selectedChamberText =
    selectedChamber?.extra?.chamberId ||
    selectedChamber?.label ||
    selectedLabel;

  return (
    <Screen preset="fixed" statusBgColor={COLORS.PRIMARY} loading={loading}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      {/* Header with Search */}
      <BackHeader
        headerTitle="Chamber Report"
        onBackPress={() => navigation.goBack()}
      />
      {/* <View style={styles.floatingCard}>
          <View style={styles.searchBox}>
            <TextInput
              placeholder="Search chamber ID / route"
              placeholderTextColor="#0b0a0aff"
              style={styles.input}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.trim().length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.goButton}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSearch();
                }}>
                {' '}
                <Text style={styles.goButtonText}>
                  {loading ? '...' : 'GO'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View> */}
      {/* Chamber Picker */}
      {/* <View style={styles.circuitPickerInline}>
        {renderPickerBox(
          'Select Chamber',
          selectedCircuit,
          circuitList,
          setSelectedCircuit,
          isLocked,
        )}
      </View> */}
      {/* <View style={styles.rangeContainer}>
        <View style={styles.rangeBox}>
          <Text style={styles.rangeLabel}>Range (meters):</Text>
          <TextInput
            style={styles.rangeInput}
            placeholder="100"
            placeholderTextColor="#999"
            value={range}
            onChangeText={setRange}
            keyboardType="number-pad"
            maxLength={5}
          />
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleRangeApply}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View> */}
      {/* Route Info Banner */}
      {tableData.length > 0 && (
        <View style={[styles.routeInfoBanner, {marginTop: SIZE.MVS(10)}]}>
          <Text style={styles.selectedChamberText}>
            Selected Chamber: {selectedChamberText}
          </Text>

          <Text style={styles.routeInfoText}>
            Route From: {tableData[0].route_id_to} -{' '}
            {tableData[0].fiber_type_from} - {tableData[0].route_name_to}
          </Text>
        </View>
      )}
      {/* Table */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderTable()}
      </ScrollView>
    </Screen>
  );
};

export default TicketChamberReport;

const styles = StyleSheet.create({
  // Header & Search
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  floatingCard: {
    position: 'absolute',
    bottom: -SIZE.MVS(22),
    width: '92%',
    alignSelf: 'center',
    flexDirection: 'row',
    borderRadius: SIZE.MS(12),
    alignItems: 'center',
    zIndex: 1000,
  },
  searchBox: {
    width: '100%',
    marginVertical: 10,
    alignSelf: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    paddingVertical: 10,
  },
  goButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  goButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.BOLD,
  },
  nodatafounddivnew: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  ticketsParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  noDataFound2: {
    fontSize: 15,
    color: COLORS.colorDarkslategray300,
    opacity: 0.6,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  circuitPickerInline: {
    width: '92%',
    alignSelf: 'center',
    marginTop: SIZE.MVS(16),
    marginBottom: SIZE.MVS(8),
  },
  box: {
    backgroundColor: COLORS.WHITE,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFE3E8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 👇 NEW: visual treatment for the locked/auto-selected state so it's
  // clear to the user this box isn't tappable right now.
  boxDisabled: {
    backgroundColor: '#F2F3F5',
    borderColor: '#E5E7EB',
  },
  boxLabel: {
    fontSize: 14,
    color: '#111',
    flex: 1,
  },
  boxLabelDisabled: {
    color: '#8A8F98',
  },
  rightArrow: {
    width: 18,
    height: 18,
    tintColor: '#999',
  },
  // Route Info Banner
  routeInfoBanner: {
    width: '92%',
    alignSelf: 'center',
    backgroundColor: '#E5E9FB',
    paddingVertical: SIZE.MVS(10),
    paddingHorizontal: SIZE.MS(10),
    marginBottom: SIZE.MVS(8),
    borderRadius: 8,
  },
  routeInfoText: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: '#333',
  },
  Iconnew: {
    width: 125,
    height: 125,
    alignSelf: 'center',
    resizeMode: 'contain',
  },

  // Table Styles - BIGGER CELLS
  tableContainer: {
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  headerCellSno: {
    width: 70,
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
    borderRightWidth: 1,
    borderColor: '#ccc',
    fontFamily: FONTS.MEDIUM,
  },
  headerCell: {
    width: SIZE.MS(180),
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: FONTS.MEDIUM,
    padding: 12,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  selectedChamberText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY,
    marginBottom: SIZE.MVS(6),
  },
  dataCellSno: {
    width: SIZE.MS(70),
    padding: SIZE.MS(12),
    textAlign: 'center',
    fontSize: SIZE.MS(13),
    color: '#333',
    borderBottomWidth: 1,
    fontFamily: FONTS.MEDIUM,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  dataCell: {
    width: SIZE.MS(180),
    padding: SIZE.MS(12),
    textAlign: 'center',
    fontSize: SIZE.MS(13),
    color: '#333',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    fontFamily: FONTS.MEDIUM,
    borderColor: '#ccc',
  },
  rangeContainer: {
    width: '92%',
    alignSelf: 'center',
    marginBottom: 8,
  },

  rangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  rangeLabel: {
    fontSize: 13,
    color: '#333',
    fontFamily: FONTS.SEMI_BOLD,
    marginRight: 8,
  },

  rangeInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontFamily: FONTS.MEDIUM,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
  },

  applyButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },

  applyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
  },
});
