import {APIs, URLs} from '@apis';
import {Buttons, ListView} from '@atoms';
import {DEVELOPER_NAME} from '@env';
import {
  LocationPermission,
  SyncOfflineDataSheet,
  UserNameDesigRow,
} from '@molecules';
import {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, CONSTANT, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {todayAttendanceApi} from '@slices/attendance.slice';
import {
  dashboardListApi,
  getLoginTokenApi,
  addUserDeviceDetailsApi,
  getUserModulePolicyMappingApi,
  mobileAppVersionVendorList,
} from '@slices/dashboard.slice';
import {DataType, ScreenProps} from '@types';
import {attachPosterDispatch} from '../../services/LocationPosterCore';
import {startForegroundPoster} from '../../services/ForegroundLocationPoster';
import {
  attachDispatch,
  startLocationBatteryService,
} from '../../services/LocationBatteryService';
import WelcomeModal from '../../components/molecules/WelcomeModal';
import {
  FontSize,
  LineHeight,
  Padding,
  FontFamily,
  Height,
  Width,
  BoxShadow,
  Border,
} from '../../res/globalStyle';
import {
  Common,
  Location,
  Permissions,
  Preferences,
  // Services,
  Voice,
} from '@utils';
import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  AppState,
  Image,
  StyleSheet,
  Text,
  Platform,
  View,
  Linking,
  NativeModules,
  StatusBar,
  NativeEventEmitter,
  TouchableOpacity, // ✅ added
  Easing,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as Animiatable from 'react-native-animatable';
import {connect, useDispatch} from 'react-redux';
import DeviceInfo from 'react-native-device-info';
type MobileVersion = {
  project_name?: string;
  access_url?: string;
  version_name?: string;
  version_code?: string | number;
  description?: string;
};
export interface ProjectListItemProps {
  data: DataType.Project;
  index?: number;
}
export interface ModuleListItemProps {
  data: DataType.Module;
}
export interface SubModuleListItemProps {
  item: DataType.SubModule;
}
interface ModuleCardProps {
  tone?: number;
  title: string;
  image: string;
  onPress?: () => void;
}
let navigator: NativeStackNavigationProp<RootStackParamList>;
const check = (name: string, lName: string) =>
  Common.isEqualIgnoreCase(name, lName);
const pickGoogleMapKey = (r: any) =>
  r?.googleMapKey ?? r?.data?.googleMapKey ?? null;
const employeeId = (r: any) =>
  r?.employeeDetails?.id ?? r?.data?.employeeDetails?.id ?? null;
const userId = (r: any) =>
  r?.employeeDetails?.userId ?? r?.data?.employeeDetails?.userId ?? null;

const formatBytes = (n?: number) => {
  if (!n || n <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ===== Version compare helpers =====
const toParts = (v?: string | number) =>
  String(v ?? '')
    .trim()
    .split('.')
    .map(s => parseInt(s, 10))
    .map(n => (Number.isFinite(n) ? n : 0));
const cmpDot = (a: string | number, b: string | number) => {
  const A = toParts(a);
  const B = toParts(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const av = A[i] ?? 0;
    const bv = B[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
};
const isServerNewerThanInstalled = async (serverCode?: string | number) => {
  const sc = String(serverCode ?? '').trim();
  if (!sc) return false;
  if (sc.includes('.')) {
    const appVerName = DeviceInfo.getVersion();
    return cmpDot(sc, appVerName) > 0;
  }
  const appBuild = parseInt(DeviceInfo.getBuildNumber(), 10) || 0;
  const srvBuild = parseInt(sc, 10) || 0;
  return srvBuild > appBuild;
};
// ===== iOS OTA helpers: probe & open
type HeadProbe = {
  ok: boolean;
  status: number;
  contentType?: string | null;
  contentLength?: number | null;
  url: string;
  error?: string;
};
const normalizeUrl = (raw: string) => {
  let u = raw.trim();
  // Remove accidental double slashes after host
  u = u.replace(/([^:])\/{2,}/g, '$1/'); // keeps "https://"
  return u;
};

// Try HEAD first; if blocked, try Range GET (1 byte) to fetch headers without downloading file
const probeUrl = async (url: string): Promise<HeadProbe> => {
  try {
    const res = await fetch(url, {method: 'HEAD' as any});
    const ct = res.headers.get('content-type');
    const cl = parseInt(res.headers.get('content-length') || '', 10);
    return {
      ok: res.ok,
      status: res.status,
      contentType: ct,
      contentLength: Number.isFinite(cl) ? cl : null,
      url: res.url || url,
    };
  } catch (_e) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {Range: 'bytes=0-0'},
      } as any);
      const ct = res.headers.get('content-type');
      const cl = parseInt(res.headers.get('content-length') || '', 10);
      return {
        ok: res.ok || res.status === 206,
        status: res.status,
        contentType: ct,
        contentLength: Number.isFinite(cl) ? cl : null,
        url: res.url || url,
      };
    } catch (e: any) {
      return {
        ok: false,
        status: 0,
        contentType: null,
        contentLength: null,
        url,
        error: e?.message || String(e),
      };
    }
  }
};
export const formatDateTime = (
  dateString: string,
  locale: string = 'en-IN',
) => {
  return new Date(dateString).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};
const isPlistUrl = (u: string) =>
  /\.plist(\?|$)/i.test(u) || /manifest\.plist/i.test(u);
const isIpaUrl = (u: string) => /\.ipa(\?|$)/i.test(u);
const toItmsFromPlist = (manifestUrl: string) =>
  `itms-services://?action=download-manifest&url=${encodeURIComponent(
    manifestUrl,
  )}`;
export const hasTicketAccess = (dashboardList: any): boolean => {
  if (!dashboardList?.projectListAll) return false;
  return dashboardList.projectListAll.some((project: any) =>
    project.modules?.some(
      (module: any) =>
        module.moduleName?.toUpperCase() === 'TICKETS' &&
        module.subModules?.some(
          (sub: any) =>
            sub.subModuleName?.toUpperCase() === 'TICKETS' &&
            sub.polices?.some((p: any) =>
              [
                'AccessTicket',
                'AccessComplaint',
                'ViewAssignedTicket',
                'ViewTickets',
              ].includes(p.policyName),
            ),
        ),
    ),
  );
};

const openOtaIOS = async (rawUrl: string) => {
  const url = normalizeUrl(rawUrl);
  const probe = await probeUrl(url);
  if (!probe.ok) {
    Common.alert({
      title: 'Update link not reachable',
      msg:
        `URL: ${url}\n` +
        (probe.status ? `Status: ${probe.status}\n` : '') +
        (probe.error
          ? `Error: ${probe.error}`
          : 'Server did not respond as expected'),
    });
    return;
  }
  if (isPlistUrl(url)) {
    if (!url.startsWith('https://')) {
      Common.alert({
        title: 'Manifest must be HTTPS',
        msg: 'iOS requires the manifest.plist to be served over HTTPS.',
      });
      return;
    }
    const itms = toItmsFromPlist(url);
    const can = await Linking.canOpenURL(itms);
    if (!can) {
      Common.alert({title: 'Cannot open installer', msg: itms});
      return;
    }
    await Linking.openURL(itms);
    return;
  }
  if (isIpaUrl(url)) {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Common.alert({title: 'Cannot open URL in Safari', msg: url});
      return;
    }
    await Linking.openURL(url);
    return;
  }
  const can = await Linking.canOpenURL(url);
  if (!can) {
    Common.alert({title: 'Cannot open URL', msg: url});
    return;
  }
  await Linking.openURL(url);
};
// ===== NAVIGATION FOR SUB-MODULES =====
const moduleNavigation = (item: DataType.SubModule, dashboardList?: any) => {
  Common.log('item', item);
  console.log('itemData', {item});
  if (
    check(item.subModuleName, 'TICKETS') ||
    check(item.subModuleName, 'COMPLAINTS') ||
    check(item.subModuleName, 'FIBER MAINTENANCE') ||
    check(item.subModuleName, 'SPLICER TICKET') ||
    check(item.subModuleName, 'COMPLAINT MANAGEMENT')
  ) {
    const hasTicketAccess = item.polices?.some(
      p =>
        p.policyName === 'ViewComplaint' ||
        p.policyName === 'AccessTicket' ||
        p.policyName === 'ViewTickets' ||
        p.policyName === 'AccessComplaints',
    );
    if (hasTicketAccess) {
      Common.success('✅ Opening Tickets Module');
      // ✅ Now sending empData with all required fields
      navigator?.getParent()?.navigate('TicketsList', {
        empData: {
          employeeId: dashboardList?.employeeDetails?.id,
          designationName: dashboardList?.employeeDetails?.designationName,
          employeeName: `${dashboardList?.employeeDetails?.firstName ?? ''} ${
            dashboardList?.employeeDetails?.middleName ?? ''
          } ${dashboardList?.employeeDetails?.lastName ?? ''}`.trim(),
        },
      });
    } else {
      Common.showToast('❌ Access Denied for Tickets Module');
    }
    return;
  }
  if (check(item.subModuleName, 'ATTENDANCE')) {
    const isViewAllow = item.polices?.some(
      p => p.policyName === 'ViewAttendance',
    );
    const isMarkAllow = item.polices?.some(
      p => p.policyName === 'MarkAttendance',
    );
    navigator?.getParent()?.navigate('AttendanceDashboard', {
      shiftType: 'single',
      isViewAllow,
      isMarkAllow,
    });
  } else if (check(item.subModuleName, 'CONTACTS')) {
    navigator?.getParent()?.navigate('ContactsList');
  } else if (check(item.subModuleName, 'HOLIDAY')) {
    navigator?.getParent()?.navigate('HolidaysList');
  } else if (check(item.subModuleName, 'DOUBLE DUTY')) {
    const isViewAllow = item.polices?.some(
      p => p.policyName === 'ViewDoubleDuty',
    );
    const isMarkAllow = item.polices?.some(
      p => p.policyName === 'MarkDoubleDuty',
    );
    navigator?.getParent()?.navigate('DDAttendanceDashboard', {
      shiftType: 'double',
      isViewAllow,
      isMarkAllow,
    });
  } else if (check(item.subModuleName, 'PAYROLL')) {
    navigator.navigate('MonthlySalary');
  } else if (check(item.subModuleName, 'ROAD PROJECT SURVEY')) {
    navigator?.getParent()?.navigate('RoadProject');
  } else if (check(item.subModuleName, 'CHAMBER COMPLAINT')) {
    navigator?.getParent()?.navigate('AddChamberComplaint');
  } else if (check(item.subModuleName, 'PATROLLER TASK')) {
    navigator?.getParent()?.navigate('PatrollerTask');
  } else if (check(item.subModuleName, 'CHAMBER DISTANCE')) {
    navigator?.getParent()?.navigate('ChamberDetailsScreen');
  } else if (check(item.subModuleName, 'Search By Customer Name')) {
    navigator?.getParent()?.navigate('SearchCustomer');
  } else if (check(item.subModuleName, 'Chamber Report')) {
    navigator?.getParent()?.navigate('ChamberReport');
  } else if (check(item.subModuleName, 'Chamber Correction')) {
    navigator?.getParent()?.navigate('ChamberListScreen');
  } else if (check(item.subModuleName, 'Overtime')) {
    navigator?.getParent()?.navigate('OverTime');
  } else if (check(item.subModuleName, 'Pit Installation')) {
    navigator?.getParent()?.navigate('DssProjectPickerScreen');
  } else if (check(item.subModuleName, 'Shot Installation')) {
    navigator.navigate('ShotIstallationProjectScreen');
  } else if (check(item.subModuleName, 'Fiber Installation')) {
    navigator.navigate('FiberProjectPickerScreen');
  } else if (check(item.subModuleName, 'Chamber Installation')) {
    navigator.navigate('ChamberProjectPickerScreen');
  } else if (check(item.subModuleName, 'Stock Movement')) {
    navigator.navigate('StockProjectPickerScreen');
  } else if (check(item.subModuleName, 'Shot With ABD')) {
    navigator.navigate('ABDProjectPickerScreen');
  } else if (check(item.subModuleName, 'Project Hoto')) {
    navigator.navigate('HotoProjectPickerScreen');
  } else if (check(item.subModuleName, 'ADD ACTIVITY')) {
    navigator.navigate('AddCutScreen');
  } else if (check(item.subModuleName, 'PROJECT TO PROJECT')) {
    navigator.navigate('EmployeeVehicleScreen');
  } else if (check(item.subModuleName, 'LEAVES')) {
    navigator.navigate('LeaveStatusScreen');
  } else if (__DEV__) {
    navigator.navigate('DeveloperPKPScreen');
  } else {
    Common.showToast(item.subModuleName + ' is Under Development');
  }
};
// ===== UI bits =====
// ✅ Whole card is now pressable; "Open" button removed.
const serviceColors = ['#E5F3FF', '#EEE8FF', '#E2F5EC', '#FFF0E1'];
const ModuleCard: FC<ModuleCardProps> = ({title, image, onPress, tone = 0}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animatePress = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 28,
      bounciness: 4,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return (
    <Animated.View style={{transform: [{scale}]}}>
      <TouchableOpacity
        style={styles.moduleCardContainer}
        accessibilityRole="button"
        accessibilityLabel={title}
        onPressIn={() => animatePress(0.96)}
        onPressOut={() => animatePress(1)}
        activeOpacity={CONSTANT.BUTTON_OPACITY}
        onPress={onPress}>
        <View
          style={[
            styles.moduleCardImageContainer,
            {backgroundColor: serviceColors[tone % serviceColors.length]},
          ]}>
          <Image source={{uri: image}} style={styles.moduleCardImage} />
        </View>
        <Text style={styles.moduleCardTitleText}>{title}</Text>
        <Text style={styles.openServiceText}>Open service →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};
const ProjectList = memo(
  ({
    data,
    desc,
    code,
    onRefresh,
    employeeName,
    showWelcome,
    dashboardList,
  }: {
    data: DataType.Project[];
    desc: string;
    code: string | number;
    onRefresh: () => void;
    employeeName: string;
    showWelcome: boolean; // ✅ ADD
    dashboardList?: any;
  }) => {
    return (
      <View>
        <ListView
          data={data}
          bounces
          isRefreshable
          onRefresh={onRefresh}
          ListHeaderComponent={
            <LogoView
              verCode={String(code)}
              desc={desc}
              employeeName={employeeName}
              showWelcome={showWelcome} // ✅ PASS
            />
          }
          renderItem={({item}) => (
            <ProjectListItem data={item} dashboardList={dashboardList} />
          )}
        />
      </View>
    );
  },
);
const ProjectListItem: FC<ProjectListItemProps & {dashboardList?: any}> = ({
  data,
  dashboardList,
}) => (
  <View>
    <ModuleList data={data.modules} dashboardList={dashboardList} />
  </View>
);

const ModuleList = memo(({data, dashboardList}: {data: DataType.Module[]}) => (
  <View>
    <ListView
      data={data}
      renderItem={({item}) => (
        <ModuleListItem data={item} dashboardList={dashboardList} />
      )}
    />
  </View>
));

const ModuleListItem = memo(
  ({data, dashboardList}: {data: DataType.Module; dashboardList?: any}) => (
    <Animiatable.View
      animation="fadeInUp"
      duration={450}
      useNativeDriver
      style={styles.moduleSection}>
      <Text style={styles.moduleTitleText}>{data?.moduleName}</Text>
      <SubModuleList data={data.subModules} dashboardList={dashboardList} />
    </Animiatable.View>
  ),
);

const SubModuleList = memo(
  ({
    data,
    dashboardList,
  }: {
    data: DataType.SubModule[];
    dashboardList?: any;
  }) => (
    <View style={styles.subModuleListContainer}>
      {data.map((item, index) => (
        <SubModuleListItem
          item={item}
          index={index}
          key={item?.subModuleName}
          dashboardList={dashboardList}
        />
      ))}
    </View>
  ),
);
const SubModuleListItem: FC<
  SubModuleListItemProps & {dashboardList?: any; index?: number}
> = ({item, dashboardList, index = 0}) => {
  const displayName = item.subModuleName;
  console.log('🧩 SubModule Item:', {
    name: item?.subModuleName,
    image: item?.subModuleImage,
    policies: item?.polices,
    full: item,
  });
  return (
    <Animiatable.View
      animation="fadeInUp"
      duration={450}
      delay={Math.min(index, 5) * 65}
      useNativeDriver
      key={item?.subModuleName}
      style={styles.subModuleItemView}>
      <ModuleCard
        title={displayName}
        tone={index}
        image={item.subModuleImage ?? ''}
        onPress={() => moduleNavigation(item, dashboardList)}
      />
    </Animiatable.View>
  );
};

const LogoView = ({
  desc,
  employeeName,
  showWelcome,
}: {
  desc: string;
  employeeName: string;
  showWelcome: boolean;
}) => {
  // ✅ Get version from DeviceInfo (Android settings)
  const appVersion = DeviceInfo.getVersion(); // e.g., "1.0.0"
  const buildNumber = DeviceInfo.getBuildNumber(); // e.g., "21"
  return (
    <>
      <Animiatable.View
        animation="fadeInDown"
        duration={650}
        useNativeDriver
        style={styles.workspaceBanner}>
        <View style={styles.bannerCircle} pointerEvents="none" />
        <View style={styles.bannerText}>
          <Text style={styles.workspaceEyebrow}>GIGATEL</Text>
          <Text style={styles.workspaceTitle}>Your workspace</Text>
          <Text style={styles.workspaceDescription}>
            Everything you need, in one place.
          </Text>
        </View>
        <View style={styles.bannerLogoBox}>
          <Image
            source={IMAGES.appLogo}
            style={styles.bannerLogo}
            resizeMode="contain"
          />
        </View>
      </Animiatable.View>
      {showWelcome && <WelcomeModal name={employeeName} />}
      <View style={styles.parent}>
        <View style={[styles.view, styles.viewFlexBox]}>
          {' '}
          <View style={[styles.technosoftParent, styles.viewFlexBox]}>
            <Text style={[styles.technosoft, styles.devTypo]}>Gigatel</Text>
            <View
              style={[
                styles.crown24dp1f1f1fFill1Wght20Parent,
                styles.parentFlexBox,
              ]}>
              <Image
                style={styles.crown24dp1f1f1fFill1Wght20Icon}
                resizeMode="cover"
                source={IMAGES.crown}
              />
              <Text style={[styles.dev, styles.devTypo]}>{desc}</Text>
            </View>
          </View>
          {/* Right Section - Android Icon with Version */}
          <View
            style={[
              styles.android24dp1f1f1fFill0WghtParent,
              styles.parentFlexBox,
            ]}>
            <Image
              style={styles.android24dp1f1f1fFill0WghtIcon}
              resizeMode="cover"
              source={IMAGES.android}
            />
            {/* ✅ Show build number from Android settings */}
            <Text style={[styles.v21, styles.devTypo2]}>v{appVersion}</Text>
          </View>
        </View>
      </View>
    </>
  );
};

const UpdateGateScreen = ({children}: {children: React.ReactNode}) => (
  <View style={styles.updateScreen}>
    <View style={styles.updateScreenInner}>{children}</View>
  </View>
);
const AnimatedProgressBar: FC<{
  percent?: number;
  indeterminate?: boolean;
  isError?: boolean;
}> = ({percent, indeterminate, isError}) => {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof percent === 'number' && percent >= 0) {
      Animated.timing(widthAnim, {
        toValue: Math.min(percent, 100),
        duration: 350,
        easing: Easing.out(Easing.cubic), // ✅ smoother, natural fill
        useNativeDriver: false,
      }).start();
    }
  }, [percent]);

  useEffect(() => {
    if (indeterminate) {
      const loop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => {
        loop.stop();
        shimmerAnim.setValue(0);
      };
    }
  }, [indeterminate, shimmerAnim]);

  const widthInterpolate = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 280],
  });

  const fillColor = isError ? COLORS.ERROR ?? '#E53935' : COLORS.PRIMARY;

  return (
    <View style={styles.progressTrack}>
      {indeterminate ? (
        <Animated.View
          style={[
            styles.progressIndeterminate,
            {
              backgroundColor: fillColor,
              transform: [{translateX: shimmerTranslate}],
            },
          ]}
        />
      ) : (
        <Animated.View
          style={[
            styles.progressFill,
            {backgroundColor: fillColor, width: widthInterpolate},
          ]}
        />
      )}
    </View>
  );
};
const UpdateRequiredCard = ({
  versionName,
  onUpdatePress,
  projectNames,
  currentVersionName,
  currentBuild,
  serverVersionCode,
  downloading,
  isProcessing,
  percent,
  downloaded,
  total,
  stage, // ✅ new prop: 'idle' | 'downloading' | 'verifying' | 'installing' | 'done' | 'error'
}: {
  versionName?: string;
  onUpdatePress: () => void | Promise<void>;
  projectNames: string[];
  currentVersionName?: string;
  currentBuild?: string | number;
  serverVersionCode?: string | number;
  downloading?: boolean;
  isProcessing?: boolean;
  percent?: number;
  downloaded?: number;
  total?: number;
  stage?:
    | 'idle'
    | 'downloading'
    | 'verifying'
    | 'installing'
    | 'done'
    | 'error';
}) => {
  const showLoader = downloading || isProcessing || stage === 'done';
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage === 'done') {
      Animated.spring(checkAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();
    } else {
      checkAnim.setValue(0);
    }
  }, [stage]);

  const stageLabel = () => {
    if (stage === 'done') return 'Update complete ✓';
    if (stage === 'verifying') return 'Verifying download…';
    if (stage === 'installing') return 'Installing… please wait';
    if (downloading) {
      return `Downloading…${
        typeof percent === 'number' && percent >= 0
          ? ` ${percent.toFixed(0)}%`
          : ''
      }${
        typeof downloaded === 'number' && typeof total === 'number' && total > 0
          ? ` • ${formatBytes(downloaded)} / ${formatBytes(total)}`
          : ''
      }`;
    }
    return 'Installing… please wait';
  };

  return (
    <View style={styles.updateCard}>
      <Text style={styles.updateTitle}>Update Required</Text>
      <Text style={styles.updateSubtitle}>
        A new version {versionName ? `(${versionName}) ` : ''}is available for{' '}
        {projectNames.join(', ')} and you are using an older version of the
        application. Please update to continue.
      </Text>
      {(currentVersionName || currentBuild || serverVersionCode) && (
        <Text style={styles.updateNote}>
          App: v{currentVersionName ?? '—'} (code {currentBuild ?? '—'}){'\n'}
          Server: code {serverVersionCode ?? '—'}
        </Text>
      )}

      {showLoader && (
        <Animiatable.View
          animation="fadeIn"
          duration={300}
          useNativeDriver
          style={styles.loaderWrapper}>
          {stage !== 'done' && (
            <AnimatedProgressBar
              percent={downloading ? percent : undefined}
              indeterminate={stage === 'verifying' || stage === 'installing'}
              isError={stage === 'error'}
            />
          )}

          <View style={styles.loaderRow}>
            {stage === 'done' ? (
              <Animated.View
                style={{
                  transform: [{scale: checkAnim}],
                  opacity: checkAnim,
                }}>
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              </Animated.View>
            ) : (
              <Animiatable.View
                animation="rotate"
                iterationCount="infinite"
                easing="linear"
                duration={900}
                useNativeDriver>
                <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              </Animiatable.View>
            )}
            <Animiatable.Text
              animation="pulse"
              iterationCount="infinite"
              duration={1200}
              useNativeDriver
              style={styles.loaderText}>
              {stageLabel()}
            </Animiatable.Text>
          </View>
        </Animiatable.View>
      )}

      <Buttons
        type="primary"
        title={
          downloading
            ? 'Downloading…'
            : isProcessing
            ? 'Installing…'
            : 'Update Now'
        }
        onPress={() => void onUpdatePress()}
        disabled={showLoader && stage !== 'done'}
        viewStyle={[styles.updateBtn, showLoader && styles.updateBtnDisabled]}
      />
    </View>
  );
};

const Home: FC<ScreenProps.Home> = ({
  loading,
  dashboardList,
  navigation,
  employeeDetails,
  vendorProjects,
  mobileAppVersionVendor,
}) => {
  navigator = navigation;
  const {ApkInstaller} = NativeModules;
  const [updateStage, setUpdateStage] = useState<
    'idle' | 'downloading' | 'verifying' | 'installing' | 'done' | 'error'
  >('idle');
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const isUpdateActionRef = useRef(false); // ✅ synchronous guard

  const [isUpdateProcessing, setIsUpdateProcessing] = useState(false);
  const [isLoading, setisLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [appInstalledOn, setAppInstalledOn] = useState('');
  const [appLastUpdatedOn, setAppLastUpdatedOn] = useState('');
  const [showSync, setShowSync] = useState(false);
  //const [deviceInfoSent, setDeviceInfoSent] = useState(false);
  // APK download progress (Android)
  const [dlActive, setDlActive] = useState<boolean>(false);
  const [dlPercent, setDlPercent] = useState<number>(0);
  const [dlDownloaded, setDlDownloaded] = useState<number>(0);
  const [dlTotal, setDlTotal] = useState<number>(-1);

  const [showPrivacy, setShowPrivacy] = useState(false);
  const dispatch = useDispatch<StoreDispatch>();
  const loginInfo = Preferences.getData('LOGIN_RESPONSE') ?? {};

  const userId = loginInfo?.userId;
  const companyId = loginInfo?.companyId;
  const role = loginInfo?.role;
  const designationName = loginInfo?.designaionName;
  const dashboardDesignation =
    dashboardList?.employeeDetails?.designationName ?? '';

  const isVendorEmployee =
    (dashboardDesignation || designationName || '').trim().toLowerCase() ===
    'vendoremployee';
  const userName = loginInfo?.userName;

  console.log('USER_ID ===>', userId);
  console.log('COMPANY_ID ===>', companyId);
  console.log('ROLE ===>', role);
  console.log('DESIGNATION ===>', designationName);
  const projectData = isVendorEmployee
    ? vendorProjects
    : dashboardList?.projectListAll ?? [];
  const employeeName = useMemo(() => {
    const e = dashboardList?.employeeDetails;
    console.log('ename==>', e?.firstName, e?.middleName, e?.lastName);
    return `${e?.firstName ?? ''} ${e?.middleName ?? ''} ${
      e?.lastName ?? ''
    }`.trim();
  }, [dashboardList]);
  useEffect(() => {
    dispatch(getLoginTokenApi());
    Permissions.requestPermission();
  }, [dispatch]);
  useEffect(() => {
    if (!isVendorEmployee || !userId || !companyId) {
      return;
    }
    dispatch(
      getUserModulePolicyMappingApi({
        userId,
        companyId,
      }),
    );
  }, [dispatch, isVendorEmployee, userId, companyId]);
  const sendDeviceInfo = async () => {
    try {
      const uniqueId = await DeviceInfo.getUniqueId();
      const totalBytes = Number(Preferences.getData('APP_DATA_USAGE') ?? 0);

      const totalUsageMb = (totalBytes / (1024 * 1024)).toFixed(2);

      // ✅ Read version name from Preferences
      const appVersionName =
        Preferences.getData('APP_VERSION_NAME')?.toString() ?? '';

      const payload = {
        id: 0,
        employeeId: dashboardList?.employeeDetails?.id ?? 0,

        // ✅ Send Dashboard API version name
        appVersionName: appVersionName,

        // Installed app version
        appVersionCode: DeviceInfo.getVersion(),

        appLastUpdatedOn,
        uniqueId,
        deviceModel: DeviceInfo.getModel(),
        type: Platform.OS,
        hardware: await DeviceInfo.getHardware(),
        apiLevel:
          Platform.OS === 'android'
            ? String(DeviceInfo.getApiLevelSync?.() ?? '')
            : '',
        osVersion: DeviceInfo.getSystemVersion(),
        lastActivityBy: dashboardList?.employeeDetails?.id ?? 0,
        dataUses: totalUsageMb,
        appInstalledOn,
        appLastOpenedOn: new Date().toISOString(),
      };

      console.log('APP_VERSION_NAME FROM PREF ====', appVersionName);

      console.log(
        'ADD USER DEVICE DETAILS PAYLOAD ====',
        JSON.stringify(payload, null, 2),
      );

      const response = await dispatch(
        addUserDeviceDetailsApi(payload),
      ).unwrap();

      console.log('ADD USER DEVICE DETAILS RESPONSE ====', response);
    } catch (error) {
      console.log('sendDeviceInfo Error ====', error);
    }
  };
  // useEffect(() => {
  //   if (
  //     !deviceInfoSent &&
  //     dashboardList?.employeeDetails?.id &&
  //     appInstalledOn &&
  //     appLastUpdatedOn
  //   ) {
  //     sendDeviceInfo();
  //     setDeviceInfoSent(true);
  //   }
  // }, [
  //   deviceInfoSent,
  //   dashboardList?.employeeDetails?.id,
  //   appInstalledOn,
  //   appLastUpdatedOn,
  // ]);
  useFocusEffect(
    useCallback(() => {
      const versionName =
        dashboardList?.mobileAppVersion1?.version_name ??
        dashboardList?.mobileAppVersion?.version_name;

      if (
        dashboardList?.employeeDetails?.id &&
        appInstalledOn &&
        appLastUpdatedOn &&
        versionName
      ) {
        sendDeviceInfo();
      }
    }, [dashboardList, appInstalledOn, appLastUpdatedOn]),
  );

  useEffect(() => {
    const loadAppDates = async () => {
      try {
        const firstInstallTime = await DeviceInfo.getFirstInstallTime();
        const lastUpdateTime = await DeviceInfo.getLastUpdateTime();
        console.log('Installed On:', new Date(firstInstallTime).toString());
        console.log('Updated On:', new Date(lastUpdateTime).toString());
        setAppInstalledOn(new Date(firstInstallTime).toISOString());
        setAppLastUpdatedOn(new Date(lastUpdateTime).toISOString());
      } catch (error) {
        console.log('DeviceInfo Error', error);
      }
    };
    loadAppDates();
  }, []);
  useEffect(() => {
    if (dashboardList) {
      const ticketAllowed = hasTicketAccess(dashboardList);
      Preferences.setData('HAS_TICKET_ACCESS', ticketAllowed ? 'yes' : 'no');
      console.log('[ACCESS] Ticket:', ticketAllowed);
    }
  }, [dashboardList]);
  useEffect(() => {
    const parent = navigation?.getParent?.();
    if (!parent || typeof parent.addListener !== 'function') return;
    const onTabPress = (e: any) => {
      try {
        const isForce = Preferences.getData('FORCE_UPDATE_REQUIRED') === 'yes';
        if (!isForce) return;
        // Block switching to other tabs
        e.preventDefault?.();
        Common.showToast('Update required — other tabs are disabled.');
      } catch {}
    };
    const unsub = parent.addListener('tabPress', onTabPress);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [navigation]);
  const ensurePostingServices = useCallback(async () => {
    try {
      attachDispatch(dispatch);
      attachPosterDispatch(dispatch);
      // startForegroundPoster();
      if (Platform.OS !== 'android') {
        startForegroundPoster();
      }
    } catch (e) {
      __DEV__ && console.warn('[Home] ensurePostingServices failed', e);
    }
  }, [dispatch]);
  useEffect(() => {
    void ensurePostingServices();
  }, [ensurePostingServices]);
  useEffect(() => {
    if (employeeName && employeeName.length > 0) {
      setShowWelcome(true);
    }
  }, [employeeName]);
  // Android APK installer events
  useEffect(() => {
    if (!NativeModules.ApkInstaller) return;
    const emitter = new NativeEventEmitter(NativeModules.ApkInstaller);
    const subP = emitter.addListener('ApkInstallerProgress', (e: any) => {
      setDlActive(true);
      setDlPercent(typeof e?.percent === 'number' ? e.percent : -1);
      setDlDownloaded(typeof e?.downloaded === 'number' ? e.downloaded : 0);
      setDlTotal(typeof e?.total === 'number' ? e.total : -1);
    });
    const subD = emitter.addListener('ApkInstallerDone', () => {
      setDlActive(false);
      setDlPercent(100);
      isUpdateActionRef.current = false; // ✅
      setIsUpdateProcessing(false); // ✅
    });
    const subE = emitter.addListener('ApkInstallerError', (e: any) => {
      setDlActive(false);
      isUpdateActionRef.current = false; // ✅
      setIsUpdateProcessing(false); // ✅
      Common.alert({
        title: 'Update failed',
        msg: `${e?.code ?? 'ERROR'}: ${e?.message ?? 'Unknown error'}`,
      });
    });
    return () => {
      subP.remove();
      subD.remove();
      subE.remove();
    };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      __DEV__ && console.log('[AppState]', state);
      if (
        state === 'active' ||
        state === 'background' ||
        state === 'inactive'
      ) {
        try {
          await ensurePostingServices();
        } catch (e) {
          __DEV__ && console.warn('[BG] ensure on AppState failed', e);
        }
      }
    });
    return () => sub.remove();
  }, [ensurePostingServices]);
  useEffect(() => {
    const key = pickGoogleMapKey(dashboardList);
    if (key) Preferences.setData('GOOGLE_MAPS_API_KEY', key);
  }, [dashboardList]);
  useEffect(() => {
    const appVersionName =
      dashboardList?.mobileAppVersion1?.version_name ??
      dashboardList?.mobileAppVersion?.version_name ??
      '';
    if (appVersionName) {
      Preferences.setData('APP_VERSION_NAME', appVersionName);
      console.log('[Dashboard] APP_VERSION_NAME saved:', appVersionName);
    }
  }, [dashboardList]);
  useEffect(() => {
    const eid = employeeId(dashboardList);
    if (eid) {
      Preferences.setData('EMPLOYEE_ID', eid);
      Common.log('Saved EMPLOYEE_ID in Preferences:', eid);
    }
  }, [dashboardList]);
  useEffect(() => {
    if (userId) {
      Preferences.setData('USERID', userId);
      Common.log('Saved EMPLOYEE_ID in Preferences:', userId);
    }
  }, [dashboardList]);
  useFocusEffect(
    useCallback(() => {
      if (
        dashboardList?.employeeDetails?.id &&
        dashboardList.employeeDetails.companyId
      ) {
        dispatch(
          todayAttendanceApi({
            employeeId: dashboardList?.employeeDetails?.id,
            companyId: dashboardList?.employeeDetails?.companyId,
          }),
        );
      }
    }, [
      dashboardList?.employeeDetails?.companyId,
      dashboardList?.employeeDetails?.id,
      dispatch,
    ]),
  );
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBackgroundColor(COLORS.PRIMARY, true);
      StatusBar.setBarStyle('light-content', true);
    }, []),
  );
  const syncOfflineData = async () => {
    try {
      setShowSync(false);
      setisLoading(true);
      const lastAtt = Preferences.getData('OFFLINE_ATTENDANCE');
      const param: any[] = [];
      lastAtt?.forEach((item: any) => param.push(item.params));
      const res = await APIs.postRequestWithJson({
        path: URLs.syncOfflineAttendance,
        params: {attendanceList: param},
        isAuth: true,
      });
      setisLoading(false);
      if (res?.status === 200 && res.success) {
        const msg = 'ऑफलाइन डेटा सर्वर पर सिंक हो चुका है।';
        Common.alert({
          title: 'Sync Successful',
          msg: 'Offline data sync successfully to server. \n\n' + msg,
        });
        Voice.speak(msg);
        Preferences.removeData('OFFLINE_ATTENDANCE');
      } else {
        Common.alert({
          title: 'Alert',
          msg: res?.messege ?? 'Something went wrong in offline sync.',
        });
      }
    } catch (err) {
      Common.error('Error in Sync at Home', err);
      setShowSync(false);
      setisLoading(false);
    }
  };

  const sync = () => {
    const lastAtt = Preferences.getData('OFFLINE_ATTENDANCE');
    NetInfo.fetch().then(state => {
      if (state.isConnected && lastAtt && lastAtt.length > 0) {
        Common.log('Last Attendance Data Home::::::', lastAtt);
        setShowSync(true);
      }
    });
  };
  useFocusEffect(
    useCallback(() => {
      sync();
    }, []),
  );
  const handleStartService = useCallback(async () => {
    const res = await Location.checkPermission();
    console.log('[LocationService] foreground permission:', res);
    if (res !== 'granted') {
      console.warn(
        '[LocationService] not started: foreground permission missing',
      );
      return;
    }

    const backgroundPermission =
      await Location.checkBackgroundLocationPermission();
    console.log(
      '[LocationService] background permission:',
      backgroundPermission,
    );
    if (backgroundPermission !== 'granted') {
      console.warn(
        '[LocationService] not started: Allow all the time is missing',
      );
      setShowLocationSheet(true);
      return;
    }

    Preferences.setData('FIRST_OPEN', 'no');
    Preferences.setData('ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND', 'yes');
    setShowLocationSheet(false);
    await Location.initializeConfig();
    await ensurePostingServices();

    const employee =
      Number(Preferences.getData('EMPLOYEE_ID')) ||
      Number(dashboardList?.employeeDetails?.id) ||
      Number(loginInfo?.employeeId) ||
      0;
    const company =
      Number(Preferences.getData('COMPANY_ID')) ||
      Number(dashboardList?.employeeDetails?.companyId) ||
      Number(companyId) ||
      0;
    if (employee > 0 && company > 0) {
      await startLocationBatteryService(String(employee), {companyId: company});
    } else {
      console.warn(
        '[LocationService] not started: missing employee/company ID',
        {
          employee,
          company,
        },
      );
    }
  }, [
    companyId,
    dashboardList?.employeeDetails?.companyId,
    dashboardList?.employeeDetails?.id,
    ensurePostingServices,
    loginInfo?.employeeId,
  ]);
  const vendorVersionData = mobileAppVersionVendor?.data ?? null;
  const getDashboardData = useCallback(
    (refresh: boolean) => {
      if (!isVendorEmployee) {
        console.log('Normal Employee -> dashboardListApi');
        dispatch(
          dashboardListApi({
            isRefresh: refresh,
          }),
        );
        return;
      }
      console.log('Vendor Employee -> mobileAppVersionVendorList');
      dispatch(
        mobileAppVersionVendorList({
          isRefresh: refresh,
        }),
      );
    },
    [dispatch, isVendorEmployee],
  );
  useEffect(() => {
    Common.warn('DEVELOPER_NAME::', DEVELOPER_NAME);
    getDashboardData(false);
    setShowLocationSheet(
      Preferences.getData('ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND') !== 'yes',
    );
  }, [dispatch, getDashboardData, handleStartService]);

  useFocusEffect(
    useCallback(() => {
      setShowPrivacy(false);
      handleStartService();
      Geolocation.getCurrentPosition(
        info => {
          Preferences.setData('LAST_GEO_ADDRESS', {
            address: '',
            lat: info.coords.latitude,
            long: info.coords.longitude,
          });
          Location.getAddressWithLatLong(
            info.coords.latitude,
            info.coords.longitude,
          ).then(data => {
            Preferences.setData('LAST_GEO_ADDRESS', data);
          });
        },
        err => Common.error('getCurrentPosition HOME Error::', err),
        {timeout: 20000, maximumAge: 0, enableHighAccuracy: false},
      );
    }, [handleStartService]),
  );
  // ===== Version-based update gating
  const [forcedUpdateRequired, setForcedUpdateRequired] = useState(false);
  const {forcedAccessUrl, forcedVersionName, forcedProjectName} =
    useMemo(() => {
      const versionData = isVendorEmployee
        ? vendorVersionData
        : dashboardList?.mobileAppVersion1;

      return {
        forcedAccessUrl: versionData?.fullUrl ?? versionData?.access_url,

        forcedVersionName:
          versionData?.versionName ?? versionData?.version_name,

        forcedProjectName:
          versionData?.projectName ?? versionData?.project_name ?? 'Vendor App',
      };
    }, [dashboardList, designationName, vendorVersionData]);
  useEffect(() => {
    let isActive = true;
    (async () => {
      const serverCode = isVendorEmployee
        ? vendorVersionData?.versionCode
        : dashboardList?.mobileAppVersion1?.version_code ??
          dashboardList?.mobileAppVersion?.version_code;
      try {
        if (Platform.OS === 'android') {
          const newer = await isServerNewerThanInstalled(serverCode);
          if (isActive) setForcedUpdateRequired(newer);
        } else {
          // 🧩 On iOS, never block update
          if (isActive) setForcedUpdateRequired(false);
        }
      } catch (e) {
        __DEV__ && console.warn('[VersionCheck] failed', e);
        if (isActive) setForcedUpdateRequired(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [dashboardList, vendorVersionData, designationName]);
  console.log(
    'VENDOR VERSION DATA ====',
    JSON.stringify(vendorVersionData, null, 2),
  );
  const onUpdatePress = useCallback(async () => {
    // ✅ Ek baar click hone ke baad dubara trigger nahi hoga
    if (isUpdateActionRef.current) return;
    isUpdateActionRef.current = true;
    setIsUpdateProcessing(true);

    const raw = forcedAccessUrl;
    if (!raw) {
      Common.showToast('Update URL not found');
      isUpdateActionRef.current = false;
      setIsUpdateProcessing(false);
      return;
    }

    if (Platform.OS === 'ios') {
      try {
        await openOtaIOS(raw);
      } finally {
        // iOS sirf link open karta hai, so free it up after
        isUpdateActionRef.current = false;
        setIsUpdateProcessing(false);
      }
      return;
    }

    // Android: existing APK flow
    try {
      const canInstall =
        await NativeModules.ApkInstaller?.canRequestPackageInstalls();
      if (!canInstall) {
        Common.warn('Allow “Install unknown apps” for this app to continue.');
        NativeModules.ApkInstaller?.openUnknownSourcesSettings();
        isUpdateActionRef.current = false;
        setIsUpdateProcessing(false);
        return;
      }
      setDlActive(true);
      setDlPercent(0);
      setDlDownloaded(0);
      setDlTotal(-1);
      const fileName = `Gigatel-${forcedVersionName ?? 'update'}.apk`;
      await NativeModules.ApkInstaller?.downloadAndInstall(raw, fileName);
      // ✅ ref yahi true rahega jab tak ApkInstallerDone/Error event na aaye
    } catch (e: any) {
      setDlActive(false);
      isUpdateActionRef.current = false;
      setIsUpdateProcessing(false);
      Common.alert({
        title: 'Install failed',
        msg:
          (e?.message ?? String(e)) +
          '\n\nIf you still see “App not installed – package conflicts”, ' +
          'the existing app is signed with a different key or has a different packageId. ' +
          'Use the same keystore & package, and ensure versionCode is higher, or uninstall once.',
      });
    }
  }, [forcedAccessUrl, forcedVersionName]);
  const hideDashboardModules = forcedUpdateRequired;
  useEffect(() => {
    Preferences.setData(
      'FORCE_UPDATE_REQUIRED',
      hideDashboardModules ? 'yes' : 'no',
    );
  }, [hideDashboardModules]);
  const appVersionName = DeviceInfo.getVersion();
  const appBuildNumber = DeviceInfo.getBuildNumber();
  const serverVersionCode = isVendorEmployee
    ? vendorVersionData?.versionCode
    : dashboardList?.mobileAppVersion1?.version_code ??
      dashboardList?.mobileAppVersion?.version_code;
  return (
    <Screen
      loading={loading || isLoading}
      statusBgColor={COLORS.PRIMARY}
      preset="fixed">
      {hideDashboardModules ? (
        <UpdateGateScreen>
          <UpdateRequiredCard
            versionName={forcedVersionName}
            onUpdatePress={() => void onUpdatePress()}
            projectNames={[forcedProjectName]}
            currentVersionName={appVersionName}
            currentBuild={appBuildNumber}
            serverVersionCode={serverVersionCode}
            downloading={dlActive}
            isProcessing={isUpdateProcessing} // ✅ new
            percent={dlPercent}
            downloaded={dlDownloaded}
            total={dlTotal}
          />
        </UpdateGateScreen>
      ) : (
        <>
          {Preferences.getData('FORCE_UPDATE_REQUIRED') === 'yes' && (
            <View
              style={{
                backgroundColor: COLORS.PRIMARY,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 6,
                margin: 12,
              }}>
              <Text style={{color: COLORS.WHITE, textAlign: 'center'}}>
                Update required — some sections are temporarily disabled.
              </Text>
            </View>
          )}
          {isVendorEmployee ? (
            <UserNameDesigRow
              name={userName}
              designation={designationName}
              avatarUri={loginInfo?.employeePhotoUrl}
              onBellPress={() => {}}
            />
          ) : (
            <UserNameDesigRow
              name={
                (dashboardList?.employeeDetails?.firstName ?? '') +
                ' ' +
                (dashboardList?.employeeDetails?.middleName ?? '') +
                ' ' +
                (dashboardList?.employeeDetails?.lastName ?? '')
              }
              designation={
                dashboardList?.employeeDetails?.designationName ?? ''
              }
              avatarUri={dashboardList?.employeeDetails?.employeePhotoUrl}
              onBellPress={() => {}}
            />
          )}
          <View style={styles.innerContainer}>
            <ProjectList
              onRefresh={() => {
                sync();
                getDashboardData(true);
              }}
              // data={dashboardList?.projectListAll ?? []}
              data={projectData}
              // desc={
              //   __DEV__
              //     ? 'DEV'
              //     : dashboardList?.mobileAppVersion1?.description ?? ''
              // }
              desc={URLs.Mode}
              code={dashboardList?.mobileAppVersion?.version_code ?? ''}
              employeeName={employeeName}
              // showWelcome={showWelcome}
              dashboardList={dashboardList} // ⭐ MOST IMPORTANT
            />
          </View>
          {!showPrivacy && (
            <LocationPermission
              show={showLocationSheet}
              onAllowPress={async () => {
                setShowLocationSheet(false);
                const status =
                  await Location.requestBackgroundLocationPermission();
                if (status === 'granted') {
                  await handleStartService();
                }
              }}
              onPrivacyPress={() => {
                setShowPrivacy(true);
                navigation.getParent()?.navigate('PrivacyPolicy');
              }}
            />
          )}
          {dashboardList?.employeeDetails?.firstName}
          <SyncOfflineDataSheet
            show={showSync}
            onSyncPress={() => syncOfflineData()}
          />
        </>
      )}
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading:
    state.dashboard.loading === 'pending' ||
    state.attendance.onBehalfLoading === 'pending',

  dashboardList: state.dashboard.dashboardList,
  vendorProjects: state.dashboard.vendorProjects,
  mobileAppVersionVendor: state.dashboard.mobileAppVersionVendor,
});
export default connect(MapStateToProps)(Home);
// ====== STYLES ======
const styles = StyleSheet.create({
  workspaceBanner: {
    marginTop: 8,
    marginBottom: 16,
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#E5F1FF',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -55,
    top: -70,
    backgroundColor: '#D8D5FA',
  },
  bannerText: {flex: 1},
  workspaceEyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#456AAA',
  },
  workspaceTitle: {
    fontSize: 23,
    lineHeight: 31,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1D2939',
    marginTop: 7,
  },
  workspaceDescription: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.REGULAR,
    color: '#536580',
    marginTop: 6,
  },
  bannerLogoBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLogo: {width: 40, height: 40},
  moduleSection: {
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  openServiceText: {
    fontSize: 11,
    fontFamily: FONTS.MEDIUM,
    color: '#667085',
    marginTop: 6,
    textAlign: 'center',
  },
  globe: {
    width: SIZE.MS(200),
    height: SIZE.MS(200),
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  viewBg: {
    backgroundColor: COLORS.colorGainsboro,
    flex: 1,
  },
  subModuleItemView: {width: '48%'},
  subModuleListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  innerContainer: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  moduleCardContainer: {
    width: '100%',
    minHeight: 150,
    padding: 12,
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    borderWidth: 1,
    borderColor: '#EAECF0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  moduleCardImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 52,
    height: 52,
    borderRadius: 16,
    marginBottom: 12,
  },
  moduleCardImage: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
  },
  moduleCardTitleText: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.TEXT_DARK,
    textAlign: 'center',
    marginTop: SIZE.MS(5),
  },
  moduleTitleText: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1D2939',
    textAlign: 'left',
    marginBottom: 16,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZE.MS(8),
    marginTop: SIZE.MS(4),
    marginBottom: SIZE.MS(8),
  },
  loaderText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(13),
    color: COLORS.PRIMARY,
    textAlign: 'center',
  },
  updateBtnDisabled: {
    opacity: 0.6,
  },
  updateScreen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
    paddingHorizontal: SIZE.MS(16),
    paddingVertical: SIZE.MS(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateScreenInner: {
    width: '100%',
    maxWidth: SIZE.MS(420),
  },
  updateCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    paddingVertical: SIZE.MS(20),
    paddingHorizontal: SIZE.MS(16),
    ...STYLES.SHADOW_PRIMARY_3,
  },
  updateTitle: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(22),
    color: COLORS.PRIMARY_DARK,
    marginBottom: SIZE.MS(10),
    textAlign: 'center',
  },
  updateSubtitle: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(14),
    color: COLORS.TEXT_DARK,
    marginBottom: SIZE.MS(16),
    lineHeight: SIZE.MVS(20),
    textAlign: 'center',
  },
  updateBtn: {
    alignSelf: 'center',
    paddingHorizontal: SIZE.MS(18),
    height: SIZE.MVS(44),
    borderRadius: SIZE.MS(10),
    marginTop: SIZE.MS(6),
    marginBottom: SIZE.MS(10),
  },
  updateNote: {
    marginTop: SIZE.MS(6),
    marginBottom: SIZE.MS(6),
    fontSize: SIZE.MVS(12),
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
  },
  parent: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    borderRadius: SIZE.MS(6),
  },
  devTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
  },
  devTypo2: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    color: '#0ca2dd',
    fontSize: 13,
  },
  parentFlexBox: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  view: {
    width: '100%',
    overflow: 'hidden',
    paddingHorizontal: SIZE.MVS(12),
    paddingVertical: SIZE.MVS(14),
    gap: SIZE.MVS(24),
    backgroundColor: '#FFFFFF',
  },
  view2: {
    width: '100%',
    height: SIZE.MS(1),
    marginTop: SIZE.MVS(10),
  },
  technosoftParent: {
    gap: SIZE.MS(8),
  },
  technosoft: {
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    lineHeight: LineHeight.lh_19,
    fontSize: FontSize.fs_15,
  },
  crown24dp1f1f1fFill1Wght20Parent: {
    borderRadius: 6,
    backgroundColor: '#766B6B30',
    paddingLeft: 6,
    paddingTop: Padding.padding_4,
    paddingRight: 8,
    paddingBottom: Padding.padding_4,
    gap: 3,
  },
  crown24dp1f1f1fFill1Wght20Icon: {
    height: 11,
    width: 11,
  },
  dev: {
    fontSize: 11,
    lineHeight: 13,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  android24dp1f1f1fFill0WghtParent: {
    borderRadius: 5,
  },
  android24dp1f1f1fFill0WghtIcon: {
    height: 24,
    width: 24,
  },
  loaderWrapper: {
    marginTop: SIZE.MS(4),
    marginBottom: SIZE.MS(10),
    gap: SIZE.MS(8),
  },
  progressTrack: {
    width: '100%',
    height: SIZE.MS(8),
    borderRadius: SIZE.MS(4),
    backgroundColor: COLORS.colorGainsboro,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: SIZE.MS(4),
    backgroundColor: COLORS.PRIMARY,
  },
  progressIndeterminate: {
    position: 'absolute',
    width: '45%',
    height: '100%',
    borderRadius: SIZE.MS(4),
    backgroundColor: COLORS.PRIMARY,
    opacity: 0.85,
  },
  v21: {
    color: '#0ca2dd',
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
    lineHeight: LineHeight.lh_19,
    fontSize: FontSize.fs_15,
  },
});
