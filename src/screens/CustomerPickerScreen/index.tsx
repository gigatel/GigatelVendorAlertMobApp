import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  FC,
} from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import {BackHeader} from '@molecules';
import {Screen} from '@organisms';
import {InteractionManager} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/navigator';
import {COLORS, IMAGES, SIZE} from '@res';
import {Padding, FontFamily} from '../../res/globalStyle';
type Props = NativeStackScreenProps<RootStackParamList, 'CustomerPickerScreen'>;
type PickerItem = {
  value: string | number;
  label: string;
  icon?: any;
  extra?: {
    chamberName?: string;
    distance?: number;
    startAddress?: string;
    endAddress?: string;
  };
  fullData?: any;
};

// ---- Memoized list item so it doesn't re-render on every keystroke/search change ----
const ListItem = React.memo(
  ({
    item,
    isSelected,
    onPress,
  }: {
    item: PickerItem;
    isSelected: boolean;
    onPress: (item: PickerItem) => void;
  }) => {
    return (
      <Pressable
        onPress={() => onPress(item)}
        style={[
          styles.itemContainer,
          isSelected && styles.itemContainerSelected,
        ]}>
        <View style={styles.itemContent}>
          {item?.icon && <Image source={item.icon} style={styles.itemIcon} />}
          <View style={styles.textContainer}>
            <Text
              style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}
              numberOfLines={1}>
              {item.label || 'N/A'}
            </Text>
            {item?.extra?.chamberName && (
              <Text
                style={[
                  styles.itemSubtext,
                  isSelected && styles.itemSubtextSelected,
                ]}>
                {item.extra.chamberName}
              </Text>
            )}
            {typeof item?.extra?.distance === 'number' && (
              <Text style={styles.itemDistance}>
                {item.extra.distance < 1000
                  ? `${item.extra.distance.toFixed(1)} m`
                  : `${(item.extra.distance / 1000).toFixed(2)} km`}{' '}
                away
              </Text>
            )}
            {(item?.extra?.startAddress || item?.extra?.endAddress) && (
              <Text style={styles.itemSubtext}>
                {item.extra.startAddress || ''}
                {item.extra.startAddress && item.extra.endAddress ? ' - ' : ''}
                {item.extra.endAddress || ''}
              </Text>
            )}
          </View>
        </View>
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        )}
      </Pressable>
    );
  },
);

// Stable empty-array reference so `data` doesn't get a brand new array
// identity on every render when route.params.data is undefined. A changing
// reference here was one of the causes of the item list blinking/re-mounting
// on first screen load.
const EMPTY_DATA: PickerItem[] = [];

const CustomerPickerScreen: FC<Props> = ({navigation, route}) => {
  const {selectedValue, onSelect, title} = route.params;

  const initialData = useRef(route.params.data ?? EMPTY_DATA);

  const data = initialData.current;
  // ---- TEMP DEBUG: remove after we find the root cause ----
  const renderCountRef = useRef(0);
  const prevRouteParamsRef = useRef(route.params);
  const prevDataRef = useRef(data);
  renderCountRef.current += 1;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log(
      `[CustomerPickerScreen] RENDER #${renderCountRef.current}`,
      '| route.params changed:',
      prevRouteParamsRef.current !== route.params,
      '| data ref changed:',
      prevDataRef.current !== data,
      '| data length:',
      data?.length,
      '| selectedValue:',
      selectedValue,
    );
    prevRouteParamsRef.current = route.params;
    prevDataRef.current = data;
  });
  // ---- END TEMP DEBUG ----

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search so the list isn't re-filtered/re-rendered on every single keystroke
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 150);
  }, []);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });

    return () => task.cancel();
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data || data.length === 0) return EMPTY_DATA;
    const q = (debouncedSearch || '').toLowerCase().trim();
    if (!q) return data;
    return data.filter(item => (item?.label || '').toLowerCase().includes(q));
  }, [data, debouncedSearch]);

  const handleSelect = useCallback(
    (item: PickerItem) => {
      onSelect({
        value: item.value,
        label: item.label,
        icon: item.icon,
        extra: item.extra || {},
        fullData: item.fullData || {},
      });
      navigation.goBack();
    },
    [onSelect, navigation],
  );

  const getKey = useCallback((item: PickerItem, index: number) => {
    return item?.value !== undefined && item?.value !== null
      ? `${String(item.value)}_${index}`
      : String(index);
  }, []);

  if (!ready) {
    return (
      <Screen
        preset="fixed"
        statusBarStyle="dark"
        statusBgColor={COLORS.PRIMARY}>
        <View style={{flex: 1, backgroundColor: '#fff'}} />
      </Screen>
    );
  }

  return (
    <Screen
      preset="fixed"
      statusBarStyle="dark"
      statusBgColor={COLORS.PRIMARY}
      loading={false}>
      {' '}
      <BackHeader
        headerTitle={title || 'Select'}
        onBackPress={() => navigation.goBack()}
      />
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Image source={IMAGES.search} style={styles.searchIcon} />
          <TextInput
            placeholder="Search"
            value={search}
            onChangeText={handleSearchChange}
            placeholderTextColor="#999"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>
      {/* List Results - plain ScrollView instead of FlatList. Picker lists like
          this are small (a handful to a few dozen items), so there's no real
          need for virtualization - and removing it also removes the
          batch-render / windowing behavior that was causing rows to blink
          in and out on first mount. */}
      <View style={styles.listWrapper}>
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {filtered.length === 0 ? (
            <View>
              <Image
                source={IMAGES.noImage}
                style={styles.Iconnew}
                resizeMode="cover"
              />
              <View
                style={[styles.nodatafounddivnew, styles.ticketsParentFlexBox]}>
                <Text style={styles.noDataFound2}>No Data Found</Text>
              </View>
            </View>
          ) : (
            filtered.map((item, index) => (
              <ListItem
                key={getKey(item, index)}
                item={item}
                isSelected={item.value === selectedValue}
                onPress={handleSelect}
              />
            ))
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.WHITE,
  },
  searchBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: '#999',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 12,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  itemContainer: {
    backgroundColor: COLORS.WHITE,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  itemContainerSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#4B90FF',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 20,
    height: 20,
    tintColor: '#4B90FF',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  itemLabelSelected: {
    color: '#1565C0',
  },
  itemSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  itemSubtextSelected: {
    color: '#1565C0',
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4B90FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkmark: {
    fontSize: 16,
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  Iconnew: {
    width: SIZE.MS(125),
    height: SIZE.MS(125),
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  nodatafounddivnew: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  noDataFound2: {
    fontSize: 15,
    color: COLORS.colorDarkslategray300,
    opacity: 0.6,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  itemDistance: {
    fontSize: 12,
    color: '#4B90FF',
    marginTop: 2,
    fontWeight: '600',
  },
  ticketsParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});

export default CustomerPickerScreen;
