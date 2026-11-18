import React, {useEffect, useRef, useState} from 'react';
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {Provider} from 'react-redux';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {addEventListener as addNetListener} from '@react-native-community/netinfo';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import RootNavigator from '@navigation/navigator';
import {store} from './store/store';
import './locales/i18n';
import {startOfflineSync} from '@hooks/OfflineSyncService';
import {
  setupBackgroundServiceEvents,
  setupForegroundServiceEvents,
} from './utils/locationService';

import {updateGpsStatus, updateNetStatus} from '@slices/device.slice';
import {Common, Location, Voice, Preferences} from '@utils';
import {ensureAllSirenChannel, displayWithSiren} from './utils/AllSiren';
import notificationService from './services/notificationService';

/* =======================
   🔐 ACCESS HELPERS
======================= */
const hasTicketAccess = (): boolean =>
  Preferences.getData('HAS_TICKET_ACCESS') === 'yes';

const PROTECTED_TITLES = ['Complaint Notification', 'PendingTask Notification'];

const isProtectedNotification = (title?: string) =>
  !!title && PROTECTED_TITLES.includes(title.trim());

/* =======================
   ANDROID: CREATE SIREN CHANNEL ASAP
======================= */
if (Platform.OS === 'android') {
  ensureAllSirenChannel().catch(() => {});
}

/* =======================
   PUSH PERMISSION BOOTSTRAP
======================= */
const preparePushPermissions = async () => {
  try {
    await messaging().registerDeviceForRemoteMessages();
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      Common.warn?.('Push permission not granted');
    }
  } catch (e) {
    Common.error?.('Permission error: ' + (e as Error).message);
  }
};
preparePushPermissions().catch(() => {});

/* =======================
   🔔 BACKGROUND FCM HANDLER
======================= */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    const n = remoteMessage?.notification || {};
    const d = remoteMessage?.data || {};
    const title = n.title || (d as any)?.title;

    // 🔒 BLOCK protected notifications if no Ticket access
    if (isProtectedNotification(title) && !hasTicketAccess()) {
      return;
    }

    await displayWithSiren({
      title,
      body: n.body || (d as any)?.body,
      data: d,
    });
  } catch {
    // no-op
  }
});

const App = () => {
  const [isGPSEnabled, setIsGPSEnabled] = useState(true);
  const gpsSubscription = useRef<any>(null);

  /* =======================
     INIT APP / TOKEN
  ======================= */
  const initializeApp = async () => {
    try {
      const fcmToken = await notificationService.requestPermissions();
      if (fcmToken) {
        await sendFCMTokenToBackend(fcmToken);
      }

      notificationService.onTokenRefresh(async token => {
        await sendFCMTokenToBackend(token);
      });
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    notifee.requestPermission({provisional: false}).catch(() => {});
  }, []);

  useEffect(() => {
    ensureAllSirenChannel().catch(() => {});
  }, []);

  /* =======================
     FCM FOREGROUND / OPENED
  ======================= */
  useEffect(() => {
    let unsubscribeOnMessage: (() => void) | undefined;
    let unsubscribeOpened: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;

    const initNotifications = async () => {
      try {
        const fcmToken = await notificationService.requestPermissions();
        if (fcmToken) {
          await sendFCMTokenToBackend(fcmToken);
        }

        unsubscribeTokenRefresh = messaging().onTokenRefresh(async newToken => {
          await sendFCMTokenToBackend(newToken);
        });

        const initMsg = await messaging().getInitialNotification();
        if (initMsg) {
          Common.success?.('Opened from Quit State', initMsg);
        }

        unsubscribeOpened = messaging().onNotificationOpenedApp(
          remoteMessage => {
            Common.success?.('Opened from Background', remoteMessage);
          },
        );

        // 🟢 FOREGROUND FCM
        unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
          try {
            const n = remoteMessage?.notification || {};
            const d = remoteMessage?.data || {};
            const title = n.title || (d as any)?.title;

            // 🔒 BLOCK protected notifications
            if (isProtectedNotification(title) && !hasTicketAccess()) {
              return;
            }

            await displayWithSiren({
              title,
              body: n.body || (d as any)?.body,
              data: d,
            });
          } catch (e) {
            Common.error?.('Local notif error: ' + (e as Error).message);
          }
        });
      } catch (e) {
        Common.error?.('initNotifications failed: ' + (e as Error).message);
      }
    };

    initNotifications();

    return () => {
      unsubscribeOnMessage?.();
      unsubscribeOpened?.();
      unsubscribeTokenRefresh?.();
    };
  }, []);

  /* =======================
     GPS / SERVICES / NET
  ======================= */
  useEffect(() => {
    if (Platform.OS === 'android') {
      setupForegroundServiceEvents();
      setupBackgroundServiceEvents();

      Location.checkGps().then(enabled => {
        setIsGPSEnabled(enabled);
        store.dispatch(updateGpsStatus(enabled));
      });

      const gpsEmitter = new NativeEventEmitter(NativeModules.GpsStatusModule);
      gpsSubscription.current = gpsEmitter.addListener(
        'GpsStatusChanged',
        (enabled: boolean) => {
          setIsGPSEnabled(enabled);
          store.dispatch(updateGpsStatus(enabled));
        },
      );
    }

    startOfflineSync();
    Voice.setLanguage('hi-IN');

    const netUnsubscribe = addNetListener(net => {
      const isOnline =
        (net.isConnected ?? false) || (net.isInternetReachable ?? false);
      store.dispatch(updateNetStatus(!!isOnline));
    });

    return () => {
      netUnsubscribe();
      if (gpsSubscription.current) {
        gpsSubscription.current.remove();
        gpsSubscription.current = null;
      }
    };
  }, []);

  /* =======================
     GPS ALERT
  ======================= */
  useEffect(() => {
    if (!isGPSEnabled) {
      Common.alert({
        title: 'GPS Disabled',
        msg: 'Please enable GPS to use this app.',
      });
    }
  }, [isGPSEnabled]);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </Provider>
  );
};

export default App;

/* =======================
   HELPER
======================= */
async function sendFCMTokenToBackend(token: string) {
  Common.log?.('Sending FCM Token to Backend:', token);
}
