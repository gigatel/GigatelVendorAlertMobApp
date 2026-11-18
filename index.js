import { AppRegistry, Text, TextInput, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './src/App';
import { name as appName } from './app.json';
// Siren helpers
import { ensureAllSirenChannel, displayWithSiren } from './src/utils/AllSiren';
import ChamberCouplerInstallation from '@screens/ChamberCouplerInstallation';
import { Preferences } from '@utils';
// Disable font scaling
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;
const hasTicketAccess = () => {
  return Preferences.getData('HAS_TICKET_ACCESS') === 'yes';
};
const PROTECTED_TITLES = [
  'Complaint Notification',
  'PendingTask Notification',
];
const isProtectedNotification = title => {
  return typeof title === 'string' && PROTECTED_TITLES.includes(title.trim());
};
if (Platform.OS === 'android') {
  ensureAllSirenChannel().catch(() => {});
}
messaging().setBackgroundMessageHandler(async remoteMessage => {
  try {
    const n = (remoteMessage && remoteMessage.notification) || {};
    const d = (remoteMessage && remoteMessage.data) || {};
    const title = n.title || d.title;
    if (isProtectedNotification(title) && !hasTicketAccess()) {
      return;
 }
    await ensureAllSirenChannel();
    await displayWithSiren({
      title: title || 'Alert',
      body: n.body || d.body || '',
      data: d,
    });
  } catch (e) {
  }
});
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.PRESS) {
    }
  } catch (e) {}
});
notifee.registerForegroundService(() => {
  return new Promise(resolve => {
    resolve();
  });
});
AppRegistry.registerComponent(appName, () => App);