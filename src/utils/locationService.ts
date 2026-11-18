import { APIs, URLs } from '@apis';
import notifee, {
  AndroidColor,
  AndroidForegroundServiceType,
  AndroidImportance,
  AuthorizationStatus,
  EventType,
} from '@notifee/react-native';
import Geolocation from '@react-native-community/geolocation';
import { openSettings } from 'react-native-permissions';
import { error, getNetConnection, log, success } from './common';
import { getData, removeData, setData } from './preferences';
import { checkPermission } from './location';
import { getFormatedTime } from './times';
const UPDATE_INTERVAL = 0.25 * 60 * 1000;
const NOTIFICATION_ID = 'gigatel-location-tracking';
let watchId: number | null = null;
let isServiceStarted = false;
const hasTicketAccess = (): boolean => {
  return getData('HAS_TICKET_ACCESS') === 'yes';
};
async function createNotificationChannel() {
  return await notifee.createChannel({
    id: 'locationGigatelChannel',
    name: 'Gigatel Location Tracking',
    importance: AndroidImportance.HIGH,
  });
}
async function canStartForegroundService() {
  const permission = await notifee.requestPermission();
  const channelId = await createNotificationChannel();
  return (
    permission.authorizationStatus === AuthorizationStatus.AUTHORIZED &&
    channelId
  );
}

/* =======================
   STOP FOREGROUND SERVICE
======================= */
const stopForegroundService = async () => {
  if (watchId) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }

  isServiceStarted = false;
  await notifee.stopForegroundService();
  await notifee.cancelNotification(NOTIFICATION_ID);

  log('🛑 Foreground service & tracking stopped');
};

/* =======================
   START FOREGROUND SERVICE
======================= */
export const startLocationService = async (): Promise<boolean> => {
  if (isServiceStarted) {
    success('Foreground Service Already Running');
    return true;
  }

  try {
    if (!(await canStartForegroundService())) return false;
    if (!(await checkPermission())) return false;

    const channelId = await createNotificationChannel();
    isServiceStarted = true;

    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: 'GTPL is Running',
      body: 'For update the task and data, tap for more information',
      android: {
        channelId,
        asForegroundService: true,
        smallIcon: 'ic_launcher',
        color: AndroidColor.PURPLE,
        colorized: true,
        ongoing: true,
        importance: AndroidImportance.HIGH,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION,
        ],
        actions: [
          {
            title: 'More Details',
            pressAction: { id: 'details' },
          },
          {
            title: 'Done',
            pressAction: { id: 'done' },
          },
        ],
      },
    });
    return true;
  } catch (err) {
    error('Failed to start service:', err);
    setData('FOREGROUND_SERVICE', 'no');
    return false;
  }
};
/* =======================
   FOREGROUND EVENTS
======================= */
export function setupForegroundServiceEvents() {
  const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
    const title = detail?.notification?.title;

    // 🔒 Complaint guard
    if (title === 'Complaint Notification' && !hasTicketAccess()) {
      console.log('❌ Complaint notification blocked (foreground)');
      return;
    }

    if (type === EventType.ACTION_PRESS) {
      if (detail?.pressAction?.id === 'details') {
        log('Foreground details pressed');
        if (title === 'Complaint Notification') {
          openSettings();
        }
      }

      if (detail?.pressAction?.id === 'done') {
        log('✅ Done pressed (foreground)');
        await stopForegroundService();
      }
    }
  });
  return unsubscribe;
}
/* =======================
   BACKGROUND EVENTS
======================= */
export function setupBackgroundServiceEvents() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const title = detail?.notification?.title;

    // 🔒 Complaint guard
    if (title === 'Complaint Notification' && !hasTicketAccess()) {
      console.log('❌ Complaint notification blocked (background)');
      return;
    }

    if (type === EventType.ACTION_PRESS) {
      if (detail?.pressAction?.id === 'details') {
        log('Background details pressed');
        if (title === 'Complaint Notification') {
          openSettings();
        }
      }

      if (detail?.pressAction?.id === 'done') {
        log('✅ Done pressed (background)');
        await stopForegroundService();
      }
    }
  });
}

/* =======================
   LOCATION TRACKING
======================= */
export const startLocationTracking = async (): Promise<number | null> => {
  isServiceStarted = true;
  log('Starting location tracking in the background...');

  try {
    if (!(await checkPermission())) return null;

    watchId = Geolocation.watchPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        log('BG Location::', position.coords, getFormatedTime('HH:mm:ss'));

        const isnet = await getNetConnection();
        if (isnet) {
          const lastAtt = getData('OFFLINE_ATTENDANCE');
          if (lastAtt?.length) {
            try {
              const param: any[] = [];
              lastAtt.forEach((item: any) => param.push(item.params));

              const res = await APIs.postRequestWithJson({
                path: URLs.syncOfflineAttendance,
                params: { attendanceList: param },
                isAuth: true,
              });

              if (res?.status === 200 && res.success) {
                removeData('OFFLINE_ATTENDANCE');
              }
            } catch (err) {
              error('Error in Sync', err);
            }
          }
        } else {
          setData('LAST_GEO_ADDRESS', {
            lat: latitude,
            long: longitude,
            address: 'not found',
          });
        }
      },
      err => error('Location error:', err),
      {
        distanceFilter: 10,
        interval: UPDATE_INTERVAL,
        fastestInterval: UPDATE_INTERVAL / 2,
        enableHighAccuracy: true,
      },
    );

    return watchId;
  } catch (err) {
    error('Failed to start location tracking:', err);
    return null;
  }
};

/* =======================
   STOP TRACKING (MANUAL)
======================= */
export const stopLocationTracking = (wId: number | null) => {
  if (wId) {
    Geolocation.clearWatch(wId);
    log('Location tracking stopped, watch Id:', wId);
  }
};