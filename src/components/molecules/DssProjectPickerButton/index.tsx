import React, {useState, useRef} from 'react';
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
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import {
  Gap,
  FontFamily,
  Border,
  Width,
  BoxShadow,
  Height,
  Padding,
  FontSize,
  MinHeight,
} from '../../../res/globalStyle';
import {COLORS, IMAGES, SIZE, FONTS} from '@res';
export type Route = {
  id: string;
  type: 'SP' | 'EP';
  address: string;
  distance: string;
  status: 'active' | 'pending';
};

export type Project = {
  id: string;
  projectCode: string;
  projectName: string;
  vendorCode?: string;
  vendorName?: string;
  routes: Route[];
};

type Props = {
  projects: Project[];
  selectedProjectId?: string | null;
  onSelect: (project: Project) => void;
  onDismiss: () => void;
  onReload?: () => void;
  onBack?: () => void;
};

// ─── Route Row ────────────────────────────────────────────────────────────────
const RouteRow: React.FC<{route: Route}> = ({route}) => {
  const isSP = route.type === 'SP';
  const badgeColor = isSP ? '#3EC21E' : COLORS.ERROR;
  return (
    <View style={styles.routeRow}>
      <View style={styles.span4}>
        <View style={styles.routeInner}>
          <View style={[styles.badge, {backgroundColor: badgeColor}]}>
            <Text style={styles.badgeText}>{route.type}</Text>
          </View>
          <Text style={styles.address} numberOfLines={1}>
            {route.address}
          </Text>
          <Text style={styles.distance}>{route.distance}</Text>
        </View>
      </View>
      <Image
        source={IMAGES.buttonIcon}
        style={styles.btnIcon}
        resizeMode="cover"
      />
    </View>
  );
};

// ─── Project Card ─────────────────────────────────────────────────────────────
const ProjectCard: React.FC<{
  project: Project;
  isSelected: boolean;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
  showPin: boolean; // show locationCheck icon on this card's between-row
  onLayout: (h: number) => void;
}> = ({project, isSelected, onPress, isFirst, isLast, showPin, onLayout}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.height)}
      style={[
        styles.li2ShadowBox,
        styles.cardWrapper,
        isSelected && styles.cardSelected,
      ]}>
      <View style={styles.project}>
        <View style={styles.col}>
          <View style={styles.header2}>
            <Image
              style={styles.icon}
              source={IMAGES.hddiconImg ?? IMAGES.back}
              resizeMode="contain"
            />
            <View style={styles.filterFlexBox}>
              <Text style={styles.projectCode}>
                <Text style={styles.projCode}>PROJ-CODE:</Text>
                <Text style={styles.textSpace}>{` `}</Text>
                <Text style={styles.m4s1c7a1r11}>{project.projectCode}</Text>
              </Text>
              <Text style={styles.projectCode}>
                <Text style={styles.projCode}>PROJ-NAME:</Text>
                <Text style={styles.textSpace}>{` `}</Text>
                <Text style={styles.m4s1c7a1r11}>{project.projectName}</Text>
              </Text>
              {(project.vendorCode || project.vendorName) && (
                <Text style={styles.projectCode}>
                  <Text style={styles.projCode}>{`Vendor Code/Name: `}</Text>
                  <Text style={styles.m4s1c7a1r11}>
                    {[project.vendorCode, project.vendorName]
                      .filter(Boolean)
                      .join('/')}
                  </Text>
                </Text>
              )}
            </View>
          </View>

          {/* Routes — SP above dashed connector then EP */}
          <View style={styles.routesList}>
            {project.routes.map((route, index) => (
              <React.Fragment key={route.id}>
                <RouteRow route={route} />
                {index < project.routes.length - 1 && (
                  <View style={styles.dashedConnectorWrap}>
                    <View style={styles.dashedLine} />
                  </View>
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ProjectListScreen: React.FC<Props> = ({
  projects,
  selectedProjectId,
  onSelect,
  onDismiss,
  onReload,
  onBack,
}) => {
  const [search, setSearch] = useState('');
  const [range, setRange] = useState(100);

  // Track individual card heights so we can place pin accurately
  // and know total list height for dash line
  const [cardHeights, setCardHeights] = useState<number[]>([]);
  const CARD_GAP = 8;

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return (
      p.projectName.toLowerCase().includes(q) ||
      p.projectCode.toLowerCase().includes(q)
    );
  });

  const selectedIndex = filtered.findIndex(p => p.id === selectedProjectId);

  // ── Pin top: sum of all card heights above selected + half of selected card
  const getPinTop = () => {
    if (selectedIndex < 0 || cardHeights.length === 0) return 0;
    let top = 10; // matches paddingTop of listContent
    for (let i = 0; i < selectedIndex; i++) {
      top += (cardHeights[i] ?? 130) + CARD_GAP;
    }
    top += (cardHeights[selectedIndex] ?? 130) / 2 - 14;
    return top;
  };

  // ── Dash line height: sum of all rendered card heights + gaps between them
  // Line stops right at the bottom of the last card (no extra space)
  const getDashLineHeight = () => {
    if (cardHeights.length === 0) return '100%';
    let total = 10; // paddingTop
    cardHeights.forEach((h, i) => {
      total += h;
      if (i < cardHeights.length - 1) total += CARD_GAP;
    });
    return total;
  };

  const handleCardLayout = (index: number, height: number) => {
    setCardHeights(prev => {
      const next = [...prev];
      next[index] = height;
      return next;
    });
  };

  const pinTop = getPinTop();
  const dashHeight = getDashLineHeight();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.headerBar}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Image
              source={IMAGES.back}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerTitle}>Project ({projects.length})</Text>
        <View style={styles.backBtn} />
      </View>
      {/* ── Search + Range ── */}
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
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.rangeStepper}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setRange(r => Math.max(50, r - 50))}>
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.rangeLabel}>{range}m</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setRange(r => r + 50)}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* ── List with dashed line + location pin ── */}
      <View style={styles.listOuter}>
        {/* LEFT — dashed line col. Height is fixed to list content height so
            line doesn't run past the last card */}
        <View style={styles.dashLineCol} pointerEvents="none">
          {/* Dashed line — height stops at last card bottom */}
          <View
            style={[
              styles.dashLineTrack,
              {height: typeof dashHeight === 'number' ? dashHeight : undefined},
            ]}
          />
          {/* Location pin — floats at vertical center of selected card */}
          {/* {selectedIndex >= 0 && ( */}
          <Image
            style={[styles.locationPinIcon, {top: pinTop}]}
            source={IMAGES.locationCheck}
            resizeMode="contain"
          />
          {/* )} */}
        </View>

        {/* RIGHT — FlatList */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({item, index}) => (
            <ProjectCard
              project={item}
              isSelected={item.id === selectedProjectId}
              isFirst={index === 0}
              isLast={index === filtered.length - 1}
              showPin={
                // show pin icon in the between-row of each non-last card
                index < filtered.length - 1
              }
              onPress={() => onSelect(item)}
              onLayout={h => handleCardLayout(index, h)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No projects found</Text>
            </View>
          }
          ItemSeparatorComponent={() => (
            // Between-row: locationCheck pin centered on the dashed line
            <View style={styles.separatorRow}>
              <Image
                source={IMAGES.locationCheck}
                style={styles.separatorPin}
                resizeMode="contain"
              />
            </View>
          )}
        />
      </View>

      {/* ── Footer Buttons ── */}
      <View style={styles.whereAreYouBar}>
        <Text style={styles.whereAreYouText}>Where I am?</Text>
      </View>
    </SafeAreaView>
  );
};

export default ProjectListScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // ── Header ──
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
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray ?? '#2f4f4f',
    textAlign: 'center',
    flex: 1,
  },

  // ── Search row ──
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
  searchIconImg: {
    width: 14,
    height: 14,
    tintColor: '#888',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#333',
    paddingVertical: 0,
  },
  clearText: {
    fontSize: 14,
    color: '#888',
    paddingHorizontal: 4,
  },

  // ── Range stepper ──
  rangeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    height: 40,
  },
  stepBtn: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
  },
  stepBtnText: {
    fontSize: 20,
    color: '#444',
    lineHeight: 22,
  },
  rangeLabel: {
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.switzer,
    color: '#333',
    minWidth: 44,
    textAlign: 'center',
  },

  // ── Outer container ──
  listOuter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start', // ← flex-start so dashLineCol doesn't stretch infinitely
  },

  // ── LEFT: dashed line col ──
  dashLineCol: {
    width: 28,
    alignItems: 'center',
    position: 'relative',
    paddingTop: 10,
  },
  dashLineTrack: {
    // height set dynamically from getDashLineHeight()
    // falls back to full height if cardHeights not measured yet
    position: 'absolute',
    top: 0,
    left: 13,
    width: 1,
    borderStyle: 'dashed',
    borderLeftWidth: 1.5,
    borderColor: COLORS.colorDimgray ?? '#888',
    opacity: 0.5,
  },
  locationPinIcon: {
    position: 'absolute',
    left: 0,
    width: 28,
    height: 28,
    zIndex: 10,
  },

  // ── RIGHT: FlatList ──
  list: {
    flex: 1,
  },
  listContent: {
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 16,
    // NO gap here — using ItemSeparatorComponent instead so we can put pin in it
  },

  // ── Separator between cards: shows locationCheck pin centered on dash line ──
  separatorRow: {
    height: 28, // same height as pin icon
    justifyContent: 'center',
    alignItems: 'flex-start',
    // The pin is positioned relative to the FlatList column.
    // We shift it left to sit on the dash line in dashLineCol.
    marginLeft: -28, // pulls pin back into dashLineCol space
    width: 28,
    zIndex: 5,
  },
  separatorPin: {
    width: 28,
    height: 28,
  },

  // ── Card ──
  cardWrapper: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  li2ShadowBox: {
    padding: Padding.padding_8,
    backgroundColor: COLORS.colorWhite ?? '#fff',
    borderRadius: Border.br_8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    alignSelf: 'stretch',
  },
  cardSelected: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.PRIMARY ?? '#0CA2DD',
  },
  project: {
    alignSelf: 'stretch',
    flex: 1,
  },
  col: {
    gap: Gap.gap_6,
    alignSelf: 'stretch',
  },

  // ── Card header ──
  header2: {
    gap: Gap.gap_8,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  icon: {
    height: 35,
    width: 36,
    borderRadius: Border.br_6,
    backgroundColor: '#e8f0fe',
  },
  filterFlexBox: {
    gap: Gap.gap_2,
    flex: 1,
  },
  projectCode: {
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    color: COLORS.colorDarkslategray ?? '#2f4f4f',
    alignSelf: 'stretch',
  },
  projCode: {
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
  },
  textSpace: {
    fontWeight: '600',
    fontFamily: FontFamily.switzer,
  },
  m4s1c7a1r11: {
    fontFamily: FontFamily.switzer,
    fontWeight: '400',
  },

  // ── Routes list ──
  routesList: {
    flexDirection: 'column',
    alignSelf: 'stretch',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_4,
    alignSelf: 'stretch',
  },

  // ── Dashed connector between SP and EP inside card ──
  dashedConnectorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    height: 8,
  },
  dashedLine: {
    width: 0,
    height: 8,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.colorDarkslategray ?? '#555',
    opacity: 0.45,
  },

  // ── Route content box ──
  span4: {
    borderStyle: 'solid',
    borderColor: COLORS.colorGainsboro ?? '#dcdcdc',
    borderWidth: 1,
    paddingHorizontal: Padding.padding_4,
    paddingVertical: Padding.padding_2,
    minHeight: MinHeight?.min_h_28 ?? 28,
    borderRadius: Border.br_8,
    flex: 1,
  },
  routeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_4,
    flex: 1,
  },

  // ── SP/EP badge ──
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
    fontFamily: FontFamily.switzer,
    fontWeight: '700',
    textAlign: 'center',
  },
  address: {
    color: COLORS.colorDarkslategray ?? '#2f4f4f',
    flex: 1,
    fontSize: FontSize.fs_10 ?? 10,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  distance: {
    color: COLORS.colorMediumslateblue ?? '#7B68EE',
    fontSize: FontSize.fs_10 ?? 10,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  btnIcon: {
    height: 20,
    width: 20,
    backgroundColor: '#e8f0fe',
  },

  // ── Misc typo helpers ──
  addressTypo: {
    fontSize: FontSize.fs_10 ?? 10,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  textTypo: {
    color: '#fff',
    textAlign: 'center',
    fontFamily: FontFamily.switzer,
  },

  // ── Empty ──
  emptyWrap: {alignItems: 'center', marginTop: 60},
  emptyText: {fontSize: 15, color: '#aaa'},

  // ── Footer buttons ──
  li3: {
    width: '88%',
    alignSelf: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  btns: {
    flexDirection: 'row',
    gap: Gap.gap_10,
    alignSelf: 'stretch',
  },
  span2: {
    paddingHorizontal: Padding.padding_20,
    paddingVertical: 13,
    borderRadius: Border.br_8,
    elevation: 3,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: FontSize.fs_14,
    textTransform: 'uppercase',
    fontWeight: '500',
  },

  // ── Unused but kept ──
  spanFlexBox: {gap: Gap.gap_10, flexDirection: 'row'},
  span2FlexBox: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  li2FlexBox: {justifyContent: 'center', alignItems: 'center'},
  ul3: {flexDirection: 'column', alignSelf: 'stretch'},
  li5: {gap: Gap.gap_8, flex: 1, flexDirection: 'column'},
  col2: {zIndex: 1, alignSelf: 'stretch'},
  colFlexBox: {gap: Gap.gap_4, alignItems: 'center', flexDirection: 'row'},
  liChild: {
    width: 1,
    height: 16,
    borderStyle: 'dashed',
    borderColor: COLORS.colorDarkslategray ?? '#2f4f4f',
    borderRightWidth: 1,
    opacity: 0.4,
  },
  liChildPosition: {top: '50%', position: 'absolute'},
  selectedStripe: {width: 0},
  download3Icon: {
    height: Height.height_26 ?? 26,
    width: Width.width_26 ?? 26,
    borderRadius: Border.br_8,
    backgroundColor: '#e8f0fe',
  },
  meterFlexBox: {
    gap: Gap.gap_3,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  span3: {
    borderColor: 'transparent',
    paddingHorizontal: Padding.padding_6,
    paddingVertical: Padding.padding_3,
    borderRadius: Border.br_5,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  whereAreYouBar: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SIZE.MS(16),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Border.br_8,
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
});
