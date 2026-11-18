import React, {FC, useEffect, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {RootState, AppDispatch} from '@reducers';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import {ScreenProps} from '@types';
import {COLORS, SIZE, FONTS, IMAGES} from '@res';
import {getChamberCorrectionListApi} from '../../store/slices/chamber-correction.slice';
import {Location} from '@utils';
const ChamberListScreen: FC<ScreenProps.ChamberListScreen> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [searchText, setSearchText] = useState('');
  const [range, setRange] = useState('100');
  const [currentLatLng, setCurrentLatLng] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const openMap = (latLng: string) => {
    if (!latLng) {
      Alert.alert('Error', 'Location not available');
      return;
    }
    const [lat, lng] = latLng.split(',');
    if (!lat || !lng) {
      Alert.alert('Error', 'Invalid location');
      return;
    }
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const appleMapsUrl = `http://maps.apple.com/?q=${lat},${lng}`;
    const url = Platform.OS === 'ios' ? appleMapsUrl : googleMapsUrl;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Unable to open map'),
    );
  };
  const {correctionListData, correctionListLoading} = useSelector(
    (state: RootState) => state.chamberCorrection,
  );
  /* ===== GET CURRENT LOCATION ===== */
  const fetchCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      const loc = await Location.getAddressFromLatLong();

      if (!loc?.lat || !loc?.long) {
        Alert.alert('Location Error', 'Unable to get current location');
        return;
      }
      const latlng = `${loc.lat},${loc.long}`;
      setCurrentLatLng(latlng);
      fetchChambers(latlng, range);
    } catch (e) {
      Alert.alert('Location Error', 'Please enable GPS');
    } finally {
      setLoadingLocation(false);
    }
  };
  /* ===== API CALL ===== */
  const fetchChambers = (latlng: string, rangeValue: string) => {
    const body = {
      latlng,
      labelType: 'Under Ground (GIG)',
      range: Number(rangeValue) || 100,
    };
    dispatch(getChamberCorrectionListApi(body));
  };
  useEffect(() => {
    fetchCurrentLocation();
  }, []);
  /* ===== HANDLE RANGE CHANGE ===== */
  const handleRangeSubmit = () => {
    if (!currentLatLng) {
      Alert.alert('Error', 'Location not available');
      return;
    }
    if (!range || Number(range) <= 0) {
      Alert.alert('Invalid Range', 'Please enter a valid range');
      return;
    }
    fetchChambers(currentLatLng, range);
  };
  /* ===== FILTER SEARCH ===== */
  const filteredData = correctionListData?.filter((item: any) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      item?.chamberIdStr?.toLowerCase().includes(search) ||
      item?.routeName?.toLowerCase().includes(search) ||
      item?.chamberName?.toLowerCase().includes(search)
    );
  });
  /* ===== HANDLE NAVIGATION ===== */
  const handleEditPress = (item: any) => {
    setNavigatingId(item?.chamberIdStr || item?.id);
    setTimeout(() => {
      navigation.navigate('ChamberDetailCorrection', {
        chamberData: item,
      });
      setNavigatingId(null);
    }, 300);
  };
  /* ===== RENDER ITEM ===== */
  const renderItem = ({item}: any) => {
    const isNavigating = navigatingId === (item?.chamberIdStr || item?.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          {/* Left Section */}
          <View style={styles.iconWrapper}>
            <Image
              source={IMAGES.chamberImg}
              style={styles.chamberIcon}
              resizeMode="contain"
            />
          </View>
          {/* Middle Section */}
          <View style={styles.textSection}>
            <Text style={styles.chamberCode} numberOfLines={1}>
              {item?.chamberIdStr || 'N/A'}
            </Text>
            <Text style={styles.chamberAddress} numberOfLines={2}>
              {item?.chamberName || 'Chamber Address'}
            </Text>
            {/* Bottom Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.distanceBox}>
                <Image source={IMAGES.mapLocation} style={styles.mapIcon} />
                <Text style={styles.distanceText}>
                  {Number(item.distance).toFixed(2)} m
                </Text>
              </View>
              <View style={styles.dot} />
              <Image
                style={styles.fibreIconSmall}
                source={IMAGES.FiberEnclosur}
              />
              <Text style={styles.typeText}>Underground</Text>
            </View>
          </View>
          <View style={styles.rightButtonsColumn}>
            <Pressable
              style={[styles.editButton, styles.downloadButton]}
              onPress={() => openMap(item?.chamberLatLng)}>
              <Image source={IMAGES.mapDirection} style={styles.editIcon} />
            </Pressable>
            <Pressable
              onPress={() => handleEditPress(item)}
              disabled={isNavigating}
              style={[styles.editButton, styles.editButtonMargin]}>
              {isNavigating ? (
                <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              ) : (
                <Image source={IMAGES.editImg} style={styles.editIcon} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen statusBgColor={COLORS.PRIMARY}>
      <BackHeader
        headerTitle="Chamber Correction"
        onBackPress={navigation.goBack}
      />

      {/* 📍 RANGE INPUT */}
      <View style={styles.rangeContainer}>
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
          <Pressable style={styles.applyButton} onPress={handleRangeSubmit}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </Pressable>
        </View>
      </View>
      {/* 🔍 SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Image source={IMAGES.search} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chamber or route..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>
      {/* ⏳ LOADER */}
      {(loadingLocation || correctionListLoading === 'pending') && (
        <View style={styles.fullLoader}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loaderText}>Fetching nearby chambers...</Text>
        </View>
      )}
      {/* 📋 LIST */}
      {!loadingLocation && (
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) =>
            item?.chamberIdStr || item?.id || index.toString()
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            correctionListLoading === 'fulfilled' ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchText
                    ? 'No matching chambers found'
                    : 'No chambers found near you'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
};
export default ChamberListScreen;
/* ================= STYLES ================= */
const styles = StyleSheet.create({
  // Range Input
  rangeContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  rangeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  rangeLabel: {
    fontSize: 14,
    color: '#333',
    fontFamily: FONTS.SEMI_BOLD,
    marginRight: 10,
  },

  rangeInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontFamily: FONTS.MEDIUM,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },

  applyButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },

  applyButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontFamily: FONTS.SEMI_BOLD,
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  searchIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
    tintColor: '#666',
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontFamily: FONTS.MEDIUM,
  },

  clearBtn: {
    fontSize: 18,
    color: '#999',
    paddingHorizontal: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.WHITE,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  cardContent: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
  },

  iconWrapper: {
    width: 52,
    height: 52,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  chamberIcon: {
    width: 28,
    height: 28,
    tintColor: COLORS.PRIMARY,
  },

  textSection: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  chamberCode: {
    fontSize: 15,
    color: '#1a1a1a',
    fontFamily: FONTS.SEMI_BOLD,
    marginBottom: 4,
  },

  chamberAddress: {
    fontSize: 13,
    color: '#666',
    fontFamily: FONTS.MEDIUM,
    lineHeight: 18,
    marginBottom: 6,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  distanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  mapIcon: {
    width: 13,
    height: 13,
    marginRight: 4,
    tintColor: COLORS.PRIMARY,
  },

  distanceText: {
    fontSize: 12,
    color: '#555',
    fontFamily: FONTS.MEDIUM,
  },

  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#ccc',
    marginHorizontal: 8,
  },

  fibreIconSmall: {
    width: 14,
    height: 14,
    tintColor: COLORS.ERROR,
    marginRight: 5,
  },

  typeText: {
    fontSize: 12,
    color: '#555',
    fontFamily: FONTS.MEDIUM,
  },

  // editButton: {
  //   padding: 8,
  //   borderRadius: 8,
  //   backgroundColor: '#F0F4FF',
  // },

  // editIcon: {
  //   width: 22,
  //   height: 22,
  //   tintColor: COLORS.PRIMARY,
  // },

  // List
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },

  // Loader
  fullLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontFamily: FONTS.MEDIUM,
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    fontFamily: FONTS.MEDIUM,
    textAlign: 'center',
  },
  rightButtonsColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8, // Space between buttons
  },

  editButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F0F4FF',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#E8F5E9', // Light green background for download
  },
  editButtonMargin: {
    // Optional: add margin if needed
  },
  editIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.PRIMARY,
  },
});
