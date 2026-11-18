import React, {FC, useState, useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  LayoutChangeEvent,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import Geolocation from '@react-native-community/geolocation';
import {useDispatch} from 'react-redux';
import {COLORS, IMAGES, SIZE, FONTS} from '@res';
import {ScreenProps} from '@types';
import {
  Height,
  Width,
  FontSize,
  Padding,
  MinHeight,
  Border,
  Gap,
} from '../../res/globalStyle';
import {getProjectListOfTypeByNameApi} from '../../store/slices/dss.slice';
type Route = {
  id: string;
  type: 'SP' | 'EP';
  address: string;
  distance: string;
  status: 'active' | 'pending';
};
type ReadMoreTextProps = {
  text: string;
  maxLength?: number;
};
type Project = {
  id: string;
  projectCode: string;
  projectName: string;
  vendorId?: string;
  vendorCode?: string;
  vendorName?: string;
  //newly added
  startPoint?: string;
  endPoint?: string;
  //
  distanceFromUser: number;

  routes: Route[];
};
type ApiProjectItem = {
  id: number;
  name: string;
  projectCode: string;
  projectTypeName: string;
  startAddress: string;
  vendorId: string;
  endAddress: string;
  startPoint: string;
  endPoint: string;
  distanceFromUser: number;
  createdBy?: string;
  vendorCode?: string;
  vendorName?: string;
  [key: string]: any;
};

const mapApiItemToProject = (item: ApiProjectItem): Project => {
  console.log({item});
  const distanceM = item.distanceFromUser ?? 0;
  const distanceLabel =
    distanceM >= 1000
      ? `${(distanceM / 1000).toFixed(1)}km away`
      : distanceM > 0
      ? `${Math.round(distanceM)}m away`
      : '';
  return {
    id: String(item.id),
    projectCode: item.projectCode ?? '',
    projectName: item.name ?? '',
    vendorId: item.vendorId ?? '-',
    vendorCode: item.vendorCode ?? '-',
    vendorName: item.vendorName ?? '-', //here i have to change
    //add These
    startPoint: item.startPoint ?? '',
    endPoint: item.endPoint ?? '',
    distanceFromUser: distanceM,
    routes: [
      {
        id: `sp-${item.id}`,
        type: 'SP',
        address: item.startAddress ?? '',
        distance: distanceLabel,
        status: 'active',
      },
      {
        id: `ep-${item.id}`,
        type: 'EP',
        address: item.endAddress ?? '',
        distance: distanceLabel,
        status: 'active',
      },
    ],
  };
};
const parseProjectResponse = (result: any): ApiProjectItem[] | null => {
  const payload = result?.payload;
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload?.data)) return payload.data;
  return null;
};
const DASH_HEIGHT = 5;
const DASH_GAP = 4;
const DASH_WIDTH = 1.5;
const DASH_COLOR = COLORS.colorDimgray ?? '#999';
const VerticalDashedLine: FC<{height: number}> = ({height}) => {
  if (Platform.OS === 'android') {
    return (
      <View
        style={{
          width: DASH_WIDTH,
          height,
          borderLeftWidth: DASH_WIDTH,
          borderStyle: 'dashed',
          borderColor: DASH_COLOR,
          opacity: 0.55,
        }}
      />
    );
  }
  const count = Math.floor(height / (DASH_HEIGHT + DASH_GAP));
  return (
    <View
      style={{width: DASH_WIDTH, height, overflow: 'hidden', opacity: 0.55}}>
      {Array.from({length: count + 1}).map((_, i) => (
        <View
          key={i}
          style={{
            width: DASH_WIDTH,
            height: DASH_HEIGHT,
            backgroundColor: DASH_COLOR,
            marginBottom: DASH_GAP,
          }}
        />
      ))}
    </View>
  );
};
const VerticalDashedLineAutoHeight: FC = () => {
  const [lineHeight, setLineHeight] = useState(0);
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={e => setLineHeight(e.nativeEvent.layout.height)}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: LEFT_COL_WIDTH / 2 - DASH_WIDTH / 2,
        }}>
        {lineHeight > 0 && <VerticalDashedLine height={lineHeight} />}
      </View>
    </View>
  );
};

// ─── Small dashed connector inside card (between SP and EP) ───────────────────
const DashedConnector: FC = () => {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.dashedConnectorWrap}>
        <View style={styles.dashedLine} />
      </View>
    );
  }
  // iOS: two small stacked rectangles to simulate dashes
  return (
    <View style={styles.dashedConnectorWrap}>
      <View style={{width: DASH_WIDTH, alignItems: 'center', opacity: 0.45}}>
        <View
          style={{
            width: DASH_WIDTH,
            height: 3,
            backgroundColor: COLORS.colorDarkslategray ?? '#555',
            marginBottom: 2,
          }}
        />
        <View
          style={{
            width: DASH_WIDTH,
            height: 3,
            backgroundColor: COLORS.colorDarkslategray ?? '#555',
          }}
        />
      </View>
    </View>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <Animatable.View
    animation="pulse"
    iterationCount="infinite"
    duration={1200}
    useNativeDriver
    style={styles.skeletonCard}>
    <View style={styles.skeletonHeader}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonInfo}>
        <View style={[styles.skeletonLine, {width: '60%'}]} />
        <View style={[styles.skeletonLine, {width: '80%', marginTop: 6}]} />
        <View style={[styles.skeletonLine, {width: '50%', marginTop: 6}]} />
      </View>
    </View>
    <View style={styles.skeletonRoute} />
    <View style={styles.skeletonRoute} />
  </Animatable.View>
);

const SkeletonList = () => (
  <View style={styles.skeletonListWrap}>
    {[1, 2, 3, 4].map(i => (
      <React.Fragment key={i}>
        <SkeletonCard />
        {i < 4 && <View style={styles.cardGap} />}
      </React.Fragment>
    ))}
  </View>
);

// ─── Route Row ────────────────────────────────────────────────────────────────
const RouteRow = ({route}: {route: Route}) => {
  const badgeColor = route.type === 'SP' ? '#3EC21E' : COLORS.ERROR;
  return (
    <View style={styles.routeRow}>
      <View style={styles.routeBox}>
        <View style={[styles.badge, {backgroundColor: badgeColor}]}>
          <Text style={styles.badgeText}>{route.type}</Text>
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {route.address}
        </Text>
        <Text style={styles.distance}>{route.distance}</Text>
      </View>
      <Image source={IMAGES.buttonIcon} style={styles.btnIcon} />
    </View>
  );
};

// ─── Project Card ─────────────────────────────────────────────────────────────
const ProjectCard = React.memo(
  ({
    project,
    isSelected,
    isPinned,
    onPress,
    onLayout,
  }: {
    project: Project;
    isSelected: boolean;
    isPinned: boolean;
    onPress: () => void;
    onLayout: (h: number) => void;
  }) => {
    const routes = Array.isArray(project.routes) ? project.routes : [];
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onLayout={(e: LayoutChangeEvent) =>
          onLayout(e.nativeEvent.layout.height)
        }
        style={[
          styles.card,
          isSelected && styles.selectedCard,
          isPinned && styles.pinnedCard,
        ]}>
        <View style={styles.cardHeader}>
          <Image
            style={styles.cardIcon}
            source={IMAGES.hddiconImg ?? IMAGES.back}
            resizeMode="contain"
          />
          <View style={styles.cardInfo}>
            <Text style={styles.projectCode}>
              <Text style={styles.labelBold}>PROJ-CODE: </Text>
              <Text style={styles.labelNormal}>{project.projectCode}</Text>
            </Text>
            <Text style={styles.projectCode}>
              <Text style={styles.labelBold}>PROJ-NAME: </Text>
              <Text style={styles.labelNormal}>{project.projectName}</Text>
            </Text>
            {(project.vendorCode || project.vendorName) && (
              <Text style={styles.projectCode}>
                <Text style={styles.labelBold}>Vendor Code/Name: </Text>
                <Text style={styles.labelNormal}>
                  {[project.vendorCode, project.vendorName]
                    .filter(Boolean)
                    .join(' / ')}
                </Text>
              </Text>
            )}
          </View>
        </View>
        <View style={styles.routesList}>
          {routes.map((route, index) => (
            <React.Fragment key={route.id}>
              <RouteRow route={route} />
              {index < routes.length - 1 && <DashedConnector />}
            </React.Fragment>
          ))}
        </View>
      </TouchableOpacity>
    );
  },
);

// ─── Constants ────────────────────────────────────────────────────────────────
const FALLBACK_LAT_LONG = '28.5415939,77.254606';
const CARD_GAP = 12;
const LIST_PADDING_TOP = 10;
const PIN_SIZE = 28;

// ─── Main Screen ──────────────────────────────────────────────────────────────
const DssProjectPickerScreen: FC<ScreenProps.DssProjectPickerScreen> = ({
  navigation,
}) => {
  const dispatch = useDispatch<any>();
  const flatListRef = useRef<FlatList>(null);
  const pinAnimRef = useRef<any>(null);
  const hasFetchedRef = useRef(false);
  const isFirstRangeRender = useRef(true);
  const ReadMoreText: React.FC<ReadMoreTextProps> = ({
    text,
    maxLength = 40,
  }) => {
    const [expanded, setExpanded] = useState<boolean>(false);

    const isLongText = text?.length > maxLength;

    const displayText = expanded
      ? text
      : isLongText
      ? text.substring(0, maxLength) + '...'
      : text;

    return (
      <View>
        <Text style={styles.labelNormal}>{displayText}</Text>

        {isLongText && (
          <TouchableOpacity onPress={() => setExpanded(!expanded)}>
            <Text style={styles.readMore}>
              {expanded ? 'Read Less' : 'Read More'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  const safeScrollToIndex = (index: number, list: Project[] = filtered) => {
    if (!flatListRef.current) return;
    if (!Array.isArray(list)) return;
    if (list.length === 0) return;
    if (index < 0) return;
    if (index >= list.length) return;

    requestAnimationFrame(() => {
      try {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        });
      } catch (e) {
        console.log('Scroll prevented');
      }
    });
  };

  const autoPinClosestProject = (projects: Project[]) => {
    if (!projects?.length) {
      setPinnedId(null);
      setSelectedId(null);
      return;
    }

    const closest = [...projects].sort(
      (a, b) => a.distanceFromUser - b.distanceFromUser,
    )[0];

    if (!closest) return;

    setPinnedId(closest.id);
    setSelectedId(closest.id);

    const index = projects.findIndex(p => p.id === closest.id);

    if (index >= 0) {
      setTimeout(() => {
        safeScrollToIndex(index, projects);
      }, 400);
    }
  };
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [range, setRange] = useState('100'); // number ki jagah string
  const [rangeError, setRangeError] = useState<string | null>('');
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  // ── INSTANT LOAD: cached location first, precise GPS in background ──

  // useEffect(() => {
  //   if (isFirstRangeRender.current) {
  //     isFirstRangeRender.current = false;
  //     return;
  //   }
  //   Geolocation.getCurrentPosition(
  //     pos =>
  //       fetchProjects(`${pos.coords.latitude},${pos.coords.longitude}`, range),
  //     () => fetchProjects(FALLBACK_LAT_LONG, range),
  //     {enableHighAccuracy: false, timeout: 2000, maximumAge: 300000},
  //   );
  // }, [range]);//it have to delete
  //old useEffect
  // useEffect(() => {
  //   // only 2 to 8 digit allowed
  //   if (range.length >= 2 && range.length <= 8) {
  //     const rangeNumber = Number(range);

  //     Geolocation.getCurrentPosition(
  //       pos =>
  //         fetchProjects(
  //           `${pos.coords.latitude},${pos.coords.longitude}`,
  //           rangeNumber,
  //         ),
  //       () => fetchProjects(FALLBACK_LAT_LONG, rangeNumber),
  //       {enableHighAccuracy: false, timeout: 2000, maximumAge: 300000},
  //     );
  //   }
  // }, [range]);
  useEffect(() => {
    // Don't call API when empty
    if (range.trim().length === 0) {
      setProjectList([]);
      setPinnedId(null);
      setSelectedId(null);
      setLoading(false);
      setRangeError('Enter range');
      return;
    }

    const rangeNumber = Number(range);

    if (rangeNumber <= 0) {
      setProjectList([]);
      setPinnedId(null);
      setSelectedId(null);
      setLoading(false);
      setRangeError('Enter range');
      return;
    }

    setRangeError('');

    Geolocation.getCurrentPosition(
      pos =>
        fetchProjects(
          `${pos.coords.latitude},${pos.coords.longitude}`,
          rangeNumber,
        ),
      () => fetchProjects(FALLBACK_LAT_LONG, rangeNumber),
      {
        enableHighAccuracy: false,
        timeout: 2000,
        maximumAge: 300000,
      },
    );
  }, [range]);

  useEffect(() => {
    if (pinnedId !== null) {
      setTimeout(() => pinAnimRef.current?.rubberBand(600), 400);
    }
  }, [pinnedId]);
  const fetchProjects = (latLong: string, rangeVal: number, silent = false) => {
    if (!silent) {
      setLoading(true);
      setPinnedId(null);
      setSelectedId(null);
    }

    dispatch(
      getProjectListOfTypeByNameApi({
        page: 1,
        size: 50,
        search: '',
        latLong,
        range: rangeVal,
        serviceIds: '1,2',
      }),
    )
      .then((result: any) => {
        if (getProjectListOfTypeByNameApi.fulfilled.match(result)) {
          const data = parseProjectResponse(result);

          if (Array.isArray(data)) {
            const mapped = data.map(mapApiItemToProject);

            setProjectList(mapped);

            if (!silent && mapped.length > 0) {
              setTimeout(() => {
                autoPinClosestProject(mapped);
              }, 300);
            } else {
              setPinnedId(null);
              setSelectedId(null);
            }
          } else {
            setProjectList([]);
            setPinnedId(null);
            setSelectedId(null);
          }
        } else {
          const msg = (result.payload as string) ?? 'Failed to load projects';

          if (!silent) {
            Alert.alert('Error', msg);
          }

          setProjectList([]);
          setPinnedId(null);
          setSelectedId(null);
        }
      })
      .catch((err: any) => {
        console.error('Dispatch error:', err);

        if (!silent) {
          Alert.alert('Error', 'Failed to load projects. Please try again.');
        }

        setProjectList([]);
        setPinnedId(null);
        setSelectedId(null);
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  };

  const handleWhereAmI = () => {
    if (!Array.isArray(filtered) || filtered.length === 0) {
      Alert.alert('No Projects', 'No projects available to locate.');
      return;
      fetchProjects;
    }

    const closest = [...filtered].sort(
      (a, b) => a.distanceFromUser - b.distanceFromUser,
    )[0];

    if (!closest) return;

    setPinnedId(closest.id);
    setSelectedId(closest.id);

    const idx = filtered.findIndex(p => p.id === closest.id);

    safeScrollToIndex(idx, filtered);
  };
  const filtered = projectList.filter(p => {
    if (!p) return false;
    const q = search.toLowerCase();
    return (
      (p.projectName ?? '').toLowerCase().includes(q) ||
      (p.projectCode ?? '').toLowerCase().includes(q)
    );
  });
  const pinnedIndex = filtered.findIndex(p => p.id === pinnedId);
  const getPinTop = (): number => {
    if (pinnedIndex < 0) return -999;
    let top = LIST_PADDING_TOP;
    for (let i = 0; i < pinnedIndex; i++) {
      const id = filtered[i]?.id;
      top += (id ? cardHeights[id] ?? 120 : 120) + CARD_GAP;
    }
    const selId = filtered[pinnedIndex]?.id;
    const selH = selId ? cardHeights[selId] ?? 120 : 120;
    top += selH / 2 - PIN_SIZE / 2;
    return top;
  };

  const handleLayout = (id: string, height: number) => {
    setCardHeights(prev =>
      prev[id] === height ? prev : {...prev, [id]: height},
    );
  };

  const pinTop = getPinTop();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Image
            source={IMAGES.back}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Project ({loading ? '...' : filtered.length})
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Search + Range */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Image
            style={styles.searchIconImg}
            source={IMAGES.search}
            resizeMode="contain"
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={COLORS.colorSlategray ?? '#999'}
            value={search}
            onChangeText={text => {
              setSearch(text);
              setPinnedId(null);
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setPinnedId(null);
              }}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* //ye delete karna hai */}
        <View style={styles.rangeInputBox}>
          <TextInput
            //old
            // style={[
            //   styles.rangeInput,
            //   range.length > 0 && range.length < 2 && {borderColor: 'red'},
            // ]}
            style={[
              styles.rangeInput,
              rangeError ? {borderColor: 'red'} : null,
            ]}
            placeholder="Range"
            keyboardType="numeric"
            maxLength={8}
            value={range}
            onChangeText={text => {
              const clean = text.replace(/[^0-9]/g, '');

              // Allow empty value
              setRange(clean);

              if (clean.length === 0) {
                setRangeError('Enter range');
                return;
              }

              if (Number(clean) <= 0) {
                setRangeError('Enter range');
                return;
              }

              setRangeError('');
            }}
          />
          {/* <Text style={styles.rangeUnit}>m</Text> */}
        </View>
        {rangeError ? (
          <Text style={styles.rangeErrorText}>{rangeError}</Text>
        ) : null}
      </View>

      {/* List */}
      <View style={styles.listOuter}>
        {/* ── Left column: cross-platform vertical dashed line + pin icon ── */}
        <View style={styles.leftLineWrapper} pointerEvents="none">
          {/* ✅ FIX: replaced broken iOS borderStyle:'dashed' View with
              VerticalDashedLineAutoHeight that works on both platforms */}
          <VerticalDashedLineAutoHeight />

          {pinnedId !== null && pinnedIndex >= 0 && (
            <Animatable.Image
              ref={pinAnimRef}
              source={IMAGES.locationCheck}
              animation="rubberBand"
              iterationCount="infinite"
              duration={1400}
              useNativeDriver
              style={[styles.pinIcon, {top: pinTop}]}
              resizeMode="contain"
            />
          )}
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            ref={flatListRef}
            data={filtered}
            keyExtractor={item => item?.id ?? Math.random().toString()}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={30}
            windowSize={8}
            removeClippedSubviews
            onScrollToIndexFailed={() => {
              console.log('Scroll prevented because item not available');
            }}
            // getItemLayout={(data, index) => ({
            //   length: 140,
            //   offset: 140 * index,
            //   index,
            // })}
            renderItem={({item}) => (
              <ProjectCard
                project={item}
                isSelected={item.id === selectedId}
                isPinned={item.id === pinnedId}
                onPress={() => {
                  console.log('ItemDataL==>', {item});
                  setSelectedId(item.id);
                  const spRoute = item.routes?.find(r => r.type === 'SP');
                  const epRoute = item.routes?.find(r => r.type === 'EP');
                  navigation.navigate('AddNewPIT', {
                    projectId: item.id,
                    projectCode: item.projectCode,
                    projectName: item.projectName,
                    vendorCode: item.vendorCode,
                    vendorName: item.vendorName,
                    vendorID: item.vendorId,
                    distanceFromUser: item.distanceFromUser,
                    spRoute: spRoute ?? null,
                    epRoute: epRoute ?? null,
                    startPoint: item.startPoint,
                    endPoint: item.endPoint,
                  });
                }}
                onLayout={h => handleLayout(item.id, h)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.cardGap} />}
            ListEmptyComponent={
              <View>
                <Image
                  source={IMAGES.noImage}
                  style={styles.Iconnew}
                  resizeMode="cover"
                />
                <View
                  style={[
                    styles.nodatafounddivnew,
                    styles.ticketsParentFlexBox,
                  ]}>
                  <Text style={styles.noDataFound2}>No Data Found</Text>
                </View>
              </View>
            }
          />
        )}
      </View>

      {/* Footer */}
      <TouchableOpacity
        style={styles.whereAreYouBar}
        activeOpacity={0.85}
        onPress={handleWhereAmI}>
        <Text style={styles.whereAreYouText}>Where I am?</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default DssProjectPickerScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const LEFT_COL_WIDTH = 36;
const PIN_SIZE_STYLE = 28;

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#f5f5f5'},

  headerBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {width: 32, alignItems: 'flex-start', justifyContent: 'center'},
  backIcon: {width: 24, height: 24, tintColor: '#333'},
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray ?? '#2f4f4f',
    textAlign: 'center',
    flex: 1,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchIconImg: {width: 14, height: 14, tintColor: '#888'},
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: '#333',
    paddingVertical: 0,
  },
  clearText: {fontSize: 14, color: '#888', paddingHorizontal: 4},

  // rangeStepper: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   backgroundColor: '#f0f0f0',
  //   borderRadius: 8,
  //   overflow: 'hidden',
  //   height: 40,
  // },it have to delete
  // stepBtn: {
  //   width: 34,
  //   height: 40,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   backgroundColor: '#e0e0e0',
  // },//it have to delete
  //stepBtnText: {fontSize: 20, color: '#444', lineHeight: 22},//it have to delete
  // rangeLabel: {
  //   paddingHorizontal: 8,
  //   fontSize: 13,
  //   fontFamily: FONTS.MEDIUM,
  //   color: '#333',
  //   minWidth: 52,
  //   textAlign: 'center',
  // },//it have to delete
  rangeInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 40,
  },
  rangeInput: {
    width: 90,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: '#fff',
  },
  rangeUnit: {
    marginLeft: 4,
    fontSize: 12,
    color: '#333',
  },
  listOuter: {flex: 1, flexDirection: 'row'},
  leftLineWrapper: {width: LEFT_COL_WIDTH, position: 'relative'},
  pinIcon: {
    position: 'absolute',
    left: 0,
    width: PIN_SIZE_STYLE,
    height: PIN_SIZE_STYLE,
    zIndex: 10,
  },
  list: {flex: 1},
  listContent: {paddingTop: 10, paddingBottom: 16, paddingRight: 12},
  cardGap: {height: 12},
  ticketsParentFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  skeletonListWrap: {flex: 1, paddingTop: 10, paddingRight: 12},
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    padding: 10,
    gap: 8,
  },
  skeletonHeader: {flexDirection: 'row', gap: 8, alignItems: 'flex-start'},
  skeletonIcon: {
    width: 36,
    height: 35,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  nodatafounddivnew: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  skeletonInfo: {flex: 1},
  skeletonLine: {height: 10, borderRadius: 5, backgroundColor: '#e0e0e0'},
  skeletonRoute: {
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ececec',
    marginTop: 4,
  },
  noDataFound2: {
    fontSize: 15,
    color: COLORS.colorDarkslategray300,
    opacity: 0.6,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  Iconnew: {
    width: 125,
    height: 125,
    alignSelf: 'center',
    resizeMode: 'contain',
  },

  card: {
    backgroundColor: COLORS.colorWhite ?? '#fff',
    borderRadius: Border.br_8 ?? 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    padding: Padding.padding_8 ?? 8,
    gap: Gap.gap_6 ?? 6,
  },
  selectedCard: {borderWidth: 1.5, borderColor: COLORS.PRIMARY ?? '#0CA2DD'},
  pinnedCard: {
    borderWidth: 2,
    borderColor: COLORS.PRIMARY ?? '#0CA2DD',
    backgroundColor: '#EAF6FD',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Gap.gap_8 ?? 8,
  },
  cardIcon: {
    height: 35,
    width: 36,
    borderRadius: Border.br_6 ?? 6,
    backgroundColor: '#e8f0fe',
  },
  cardInfo: {flex: 1, gap: Gap.gap_2 ?? 2},
  projectCode: {
    fontSize: FontSize.fs_12 ?? 12,
    textAlign: 'left',
    color: COLORS.colorDarkslategray ?? '#2f4f4f',
    alignSelf: 'stretch',
  },
  labelBold: {fontFamily: FONTS.SEMI_BOLD},
  labelNormal: {fontFamily: FONTS.MEDIUM},

  routesList: {flexDirection: 'column', alignSelf: 'stretch'},
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_4 ?? 4,
    alignSelf: 'stretch',
  },

  // used only on Android for the small SP→EP connector
  dashedConnectorWrap: {paddingLeft: 12, height: 8, justifyContent: 'center'},
  dashedLine: {
    width: 0,
    height: 8,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.colorDarkslategray ?? '#555',
    opacity: 0.45,
  },

  routeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_4 ?? 4,
    borderWidth: 1,
    borderColor: COLORS.colorGainsboro ?? '#dcdcdc',
    borderRadius: Border.br_8 ?? 8,
    paddingHorizontal: Padding.padding_4 ?? 4,
    paddingVertical: Padding.padding_2 ?? 2,
    minHeight: MinHeight?.min_h_28 ?? 28,
  },
  badge: {
    borderRadius: Border.br_6_5 ?? 6,
    width: Width.width_24 ?? 24,
    height: Height.height_24 ?? 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: FontSize.fs_11 ?? 11,
    color: '#fff',
    fontFamily: FONTS.SEMI_BOLD,
    textAlign: 'center',
  },
  address: {
    color: COLORS.colorDarkslategray ?? '#2f4f4f',
    flex: 1,
    fontSize: FontSize.fs_10 ?? 10,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  distance: {
    color: COLORS.colorMediumslateblue ?? '#7B68EE',
    fontSize: FontSize.fs_10 ?? 10,
    fontFamily: FONTS.MEDIUM,
  },
  btnIcon: {height: 20, width: 20, backgroundColor: '#e8f0fe'},
  emptyWrap: {alignItems: 'center', marginTop: 60},
  emptyText: {fontSize: 15, color: '#aaa'},
  whereAreYouBar: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SIZE.MS(16),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Border.br_8 ?? 8,
    marginBottom: SIZE.MS(12),
    marginHorizontal: SIZE.MS(16),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: SIZE.MS(4),
  },
  whereAreYouText: {
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorWhite,
  },
  rangeErrorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontFamily: FONTS.MEDIUM,
  },
});
