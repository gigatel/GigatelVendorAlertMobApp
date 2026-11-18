/*
 @ 𝔸𝕦𝕥𝕙𝕠𝕣: ℙ𝕒𝕟𝕜𝕒𝕛 𝕂𝕦𝕞𝕒𝕣 ℙ𝕣𝕒𝕡𝕡𝕒𝕥𝕚
 @ 𝔼𝕞𝕒𝕚𝕝: 𝕡𝕜𝕡𝕣𝕒𝕡𝕡𝕡𝕒𝕥𝕚𝟙𝟙𝟡𝟡𝟟@𝕘𝕞𝕒𝕚𝕝.𝕔𝕠𝕞
*/
import {InputField} from '@atoms';
import {Screen} from '@organisms';
import {useFocusEffect} from '@react-navigation/native';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {Buffer} from 'buffer';
import forge from 'node-forge';
import {
  getOtpApi,
  getVendorOtpApi,
  verifyOtpApi,
  verifyVendorOtpApi,
} from '@slices/login.slice';
import {ScreenProps} from '@types';
import {Common, Preferences} from '@utils';
import React, {FC, useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {OtpInput, OtpInputRef} from 'react-native-otp-entry';
import {connect, useDispatch} from 'react-redux';
import messaging from '@react-native-firebase/messaging';
global.Buffer = global.Buffer || Buffer;

type OtpVerifyModule = {
  getHash?: () => Promise<string[]>;
  startOtpListener?: (cb: (message: string) => void) => void;
  removeListener?: () => void;
} | null;

const ENABLE_AUTO_SMS = true;
const TIMER_DURATION_MS = 90000;
// iOS QuickType / oneTimeCode suggestion bar only appears once the
// keyboard is actually open and focused on a TextInput with
// textContentType="oneTimeCode". Previously autoFocus was false, so the
// keyboard never opened on mount and the user had to manually tap the
// field first before any suggestion would show — this made it look like
// "OTP autofill isn't working on iOS" for both employee and vendor flows
// (the suggestion mechanism itself is identical for both user types,
// since it's driven purely by textContentType, not by userType).
const IOS_AUTOFOCUS_DELAY_MS = 350;

const OtpVerification: FC<ScreenProps.OtpVerification> = ({
  navigation,
  route,
  loading,
}) => {
  const {t} = useTranslation();
  const params = route?.params ?? ({} as any);
  const userId: string = params.userId ?? '';
  const password: string = params.password ?? '';
  const appType: string = params.appType ?? 'App';

  // ── userType ──────────────────────────────────────────────────────────
  const [userType, setUserType] = useState<string>('employee');
  const userTypeRef = useRef<string>('employee');

  // ── encryptionKey (VENDOR ONLY) ───────────────────────────────────────
  const encryptionKeyRef = useRef<string>('');

  // ── OTP state ─────────────────────────────────────────────────────────
  const [otpCode, setOtp] = useState('');

  // ── Timer ─────────────────────────────────────────────────────────────
  const [timerCount, setTimerCount] = useState(TIMER_DURATION_MS / 1000);
  const [resendDisabled, setResendDisabled] = useState(true);
  const timerProgress = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── FCM ───────────────────────────────────────────────────────────────
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [apnsToken, setApnsToken] = useState<string | null>(null);

  // ── Guards ────────────────────────────────────────────────────────────
  const verifyingRef = useRef(false);
  const lastSubmittedCodeRef = useRef<string | null>(null);
  const lastSubmittedAtRef = useRef<number>(0);
  const SUBMIT_DEDUP_MS = 3000;

  const otpRef = useRef<OtpInputRef | null>(null);
  const cleanupOtpListenerRef = useRef<(() => void) | null>(null);
  const tokenRefreshUnsubRef = useRef<(() => void) | null>(null);
  const autofillTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iosFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appHashRef = useRef<string>('');
  const requestedInitialOtpRef = useRef(false);
  // Guards against the Android SMS listener being registered more than once.
  // Previously, every AppState 'active' event called
  // startAndroidOtpPipelines() again with no guard, which re-registered the
  // listener on top of the existing one. This caused intermittent duplicate
  // / garbled triggers — most visible on the vendor flow because the vendor
  // verify path has an extra async step (encryption key fetch) that widens
  // the window in which a duplicate listener fire can land.
  const listenerActiveRef = useRef(false);
  const [fetchingOtp, setFetchingOtp] = useState(false);

  const dispatch = useDispatch<StoreDispatch>();

  // ── FCM init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const initPush = async () => {
      try {
        try {
          await messaging().registerDeviceForRemoteMessages();
        } catch {}
        try {
          await messaging().setAutoInitEnabled(true);
        } catch {}
        try {
          await messaging().requestPermission({
            provisional: true,
            alert: true,
            badge: true,
            sound: true,
          });
        } catch {}
        if (Platform.OS === 'ios' && (messaging() as any).getAPNSToken) {
          try {
            const apns = await (messaging() as any).getAPNSToken();
            if (mounted && apns) setApnsToken(apns);
          } catch {}
        }
        const tkn = await messaging().getToken();
        if (mounted && tkn) setFcmToken(tkn);
        tokenRefreshUnsubRef.current = messaging().onTokenRefresh(nt => {
          if (!mounted) return;
          setFcmToken(nt);
        });
      } catch {}
    };
    initPush();
    return () => {
      mounted = false;
      try {
        tokenRefreshUnsubRef.current?.();
      } catch {}
      tokenRefreshUnsubRef.current = null;
    };
  }, []);

  // ── Load USER_TYPE and ENCRYPTION_KEY ────────────────────────────────
  useEffect(() => {
    const loadPrefs = async () => {
      const type = await Preferences.getData('USER_TYPE');
      if (type) {
        userTypeRef.current = type;
        setUserType(type);
        if (__DEV__) console.log('[OTP] Loaded USER_TYPE:', type);
      }
      const key = await Preferences.getData('ENCRYPTION_KEY');
      if (key && key !== 'undefined' && key !== 'null') {
        encryptionKeyRef.current = key;
        if (__DEV__) console.log('[OTP] Loaded ENCRYPTION_KEY: ***');
      }
    };
    loadPrefs();
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setTimerCount(TIMER_DURATION_MS / 1000);
    setResendDisabled(true);

    timerProgress.setValue(0);
    animationRef.current = Animated.timing(timerProgress, {
      toValue: 1,
      duration: TIMER_DURATION_MS,
      useNativeDriver: false,
    });
    animationRef.current.start();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimerCount(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setResendDisabled(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timerProgress]);

  useFocusEffect(
    useCallback(() => {
      startCountdown();
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        animationRef.current?.stop();
        if (autofillTimeoutRef.current) {
          clearTimeout(autofillTimeoutRef.current);
          autofillTimeoutRef.current = null;
        }
        if (iosFocusTimeoutRef.current) {
          clearTimeout(iosFocusTimeoutRef.current);
          iosFocusTimeoutRef.current = null;
        }
        try {
          cleanupOtpListenerRef.current?.();
        } catch {}
        // Listener is gone now, so allow re-registration on next focus.
        listenerActiveRef.current = false;
      };
    }, [startCountdown]),
  );

  // ── iOS: auto-focus the OTP input on mount/focus so the QuickType
  // "oneTimeCode" suggestion bar shows up immediately above the keyboard,
  // for both employee and vendor (textContentType isn't userType-based,
  // so this fixes autofill for both in one place). A short delay is used
  // because focusing immediately on screen-transition can be swallowed by
  // the navigation animation on iOS.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'ios') {
        iosFocusTimeoutRef.current = setTimeout(() => {
          try {
            (otpRef.current as any)?.focus?.();
          } catch {}
        }, IOS_AUTOFOCUS_DELAY_MS);
      }
      return () => {
        if (iosFocusTimeoutRef.current) {
          clearTimeout(iosFocusTimeoutRef.current);
          iosFocusTimeoutRef.current = null;
        }
      };
    }, []),
  );

  // ── Ensure FCM token ──────────────────────────────────────────────────
  const ensureFcmToken = useCallback(async (): Promise<string | null> => {
    if (fcmToken) return fcmToken;
    try {
      await messaging().registerDeviceForRemoteMessages();
    } catch {}
    try {
      await messaging().setAutoInitEnabled(true);
    } catch {}
    for (let i = 0; i < 12; i++) {
      try {
        const apns =
          Platform.OS === 'ios' && (messaging() as any).getAPNSToken
            ? await (messaging() as any).getAPNSToken()
            : null;
        if (apns && !apnsToken) setApnsToken(apns);
        const tkn = await messaging().getToken();
        if (tkn) {
          setFcmToken(tkn);
          return tkn;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  }, [fcmToken, apnsToken]);

  // ── Ensure encryption key (VENDOR ONLY, with retry) ───────────────────
  const ensureEncryptionKey = useCallback(async (): Promise<string | null> => {
    if (
      encryptionKeyRef.current &&
      encryptionKeyRef.current !== 'undefined' &&
      encryptionKeyRef.current !== 'null'
    ) {
      return encryptionKeyRef.current;
    }
    for (let i = 0; i < 15; i++) {
      try {
        const key = await Preferences.getData('ENCRYPTION_KEY');
        if (key && key !== 'undefined' && key !== 'null') {
          encryptionKeyRef.current = key;
          if (__DEV__) console.log('[OTP] ENCRYPTION_KEY FOUND');
          return key;
        }
        if (__DEV__)
          console.log(`[OTP] waiting for ENCRYPTION_KEY retry ${i + 1}`);
      } catch (e) {
        console.log('[OTP] ensureEncryptionKey error:', e);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.warn('[OTP] ENCRYPTION_KEY missing after retries');
    return null;
  }, []);

  // ── RSA encrypt OTP (VENDOR ONLY) ──────────────────────────────────────
  const encryptOtp = async (
    otp: string,
    xmlPublicKey: string,
  ): Promise<string> => {
    try {
      const modulusMatch = xmlPublicKey.match(/<Modulus>(.*?)<\/Modulus>/);
      const exponentMatch = xmlPublicKey.match(/<Exponent>(.*?)<\/Exponent>/);
      if (!modulusMatch || !exponentMatch)
        throw new Error('Invalid XML RSA Key');

      const modulus = forge.util.encode64(forge.util.decode64(modulusMatch[1]));
      const exponentBytes = forge.util.decode64(exponentMatch[1]);
      let exponent = 0;
      for (let i = 0; i < exponentBytes.length; i++) {
        exponent = (exponent << 8) | exponentBytes.charCodeAt(i);
      }

      const publicKey = forge.pki.setRsaPublicKey(
        new forge.jsbn.BigInteger(
          forge.util.bytesToHex(forge.util.decode64(modulus)),
          16,
        ),
        new forge.jsbn.BigInteger(exponent.toString(), 10),
      );

      const encrypted = publicKey.encrypt(otp, 'RSAES-PKCS1-V1_5');
      return forge.util.encode64(encrypted).replace(/\r?\n|\r/g, '');
    } catch (error) {
      console.log('RSA Encrypt Error:', error);
      throw error;
    }
  };

  // ── Verify OTP — employee + vendor ────────────────────────────────────
  // Returns `true` if a verify request was actually dispatched, `false` if
  // it bailed out early (so the caller knows whether it's safe to retry).
  const verifyOtp = useCallback(
    async (code: string): Promise<boolean> => {
      if (verifyingRef.current) return false;
      if (!code || code.length < 6) {
        Common.showToast(
          code ? t('validation.invalid_otp') : t('validation.wait_for_otp'),
        );
        return false;
      }

      // Lock immediately and synchronously — BEFORE any async work — for
      // both employee and vendor. Previously the vendor branch only set
      // this lock *after* awaiting ensureEncryptionKey(), leaving a window
      // where the SMS listener and the OtpInput's onFilled callback could
      // both slip past the guard at (almost) the same time and fire two
      // verify attempts. That race is what made vendor autofetch flaky.
      verifyingRef.current = true;

      try {
        const token = await ensureFcmToken();
        if (!token) {
          Common.showToast(
            'Preparing push token… please try again in a moment',
          );
          return false;
        }

        const currentUserType = userTypeRef.current;
        if (__DEV__)
          console.log('[OTP] verifyOtp — userType:', currentUserType);

        const deviceType = Platform.OS + '-' + DeviceInfo.getDeviceId();

        let thunk: any;

        if (currentUserType === 'vendor') {
          // ── VENDOR: needs client-side RSA encryption using ENCRYPTION_KEY ──
          const encKey = await ensureEncryptionKey();
          if (__DEV__)
            console.log(
              '[OTP] VERIFY USING ENCRYPTION_KEY:',
              encKey ? '***' : 'MISSING',
            );
          if (!encKey) {
            Common.showToast('Missing required params');
            if (__DEV__)
              console.warn(
                '[OTP] ENCRYPTION_KEY missing — cannot verify vendor',
              );
            return false;
          }

          console.log('PLAIN OTP::', code);
          const encryptedOtp = await encryptOtp(code, encKey);
          console.log('ENCRYPTED OTP::', encryptedOtp);

          thunk = verifyVendorOtpApi({
            phoneNumber: userId,
            otp: encryptedOtp,
            appType,
            deviceToken: token,
            deviceType,
          });
        } else {
          // ── EMPLOYEE: plain OTP — slice does PEM_KEY encryption itself ──
          thunk = verifyOtpApi({
            userId,
            password,
            otp: code,
            appType,
            deviceToken: token,
            deviceType,
          });
        }

        const result: any = dispatch(thunk);
        if (typeof result?.unwrap === 'function') {
          await result.unwrap().catch(() => {});
        } else {
          await Promise.resolve(result);
        }
        return true;
      } finally {
        verifyingRef.current = false;
      }
    },
    [
      appType,
      dispatch,
      password,
      t,
      userId,
      ensureFcmToken,
      ensureEncryptionKey,
    ],
  );

  // ── Dedup submit guard ────────────────────────────────────────────────
  const submitOnce = useCallback(
    async (code: string, source: string) => {
      const now = Date.now();
      if (!code || code.length < 6) return;
      if (verifyingRef.current) return;
      if (
        lastSubmittedCodeRef.current === code &&
        now - lastSubmittedAtRef.current < SUBMIT_DEDUP_MS
      ) {
        if (__DEV__)
          console.log(`[OTP] duplicate submit ignored from ${source}`);
        return;
      }
      // Tentatively mark as submitted so a near-simultaneous second caller
      // (e.g. SMS listener firing right after onFilled) is deduped.
      lastSubmittedCodeRef.current = code;
      lastSubmittedAtRef.current = now;

      const didAttempt = await verifyOtp(code);

      // If verifyOtp bailed out early (e.g. vendor ENCRYPTION_KEY or FCM
      // token wasn't ready yet), it never actually reached the server. In
      // that case we must clear the dedup lock — otherwise the same OTP
      // code gets silently ignored for the next SUBMIT_DEDUP_MS, which is
      // exactly the "vendor autofetch doesn't work" / "OTP fails sometimes"
      // symptom: the SMS auto-read fires once too early, fails the guard
      // check internally, and then the dedup lock blocks every retry.
      if (!didAttempt) {
        lastSubmittedCodeRef.current = null;
        lastSubmittedAtRef.current = 0;
      }
    },
    [verifyOtp],
  );

  const extractOTP = (message: string) => {
    const m = message.match(/(^|[^0-9])([0-9]{6})(?![0-9])/);
    return m ? m[2] : null;
  };

  const handleOtpTextChange = useCallback((txt: string) => {
    const onlyDigits = (txt || '').replace(/\D/g, '').slice(0, 6);
    setOtp(onlyDigits);
  }, []);

  // ── Android SMS auto-read ─────────────────────────────────────────────
  const startAndroidOtpPipelines = useCallback(async () => {
    if (!ENABLE_AUTO_SMS || Platform.OS !== 'android') return;
    // Don't register a second listener on top of an already-active one.
    if (listenerActiveRef.current) {
      if (__DEV__)
        console.log('[OTP] SMS listener already active — skipping re-init');
      return;
    }
    let OtpVerify: OtpVerifyModule = null;
    try {
      OtpVerify = require('react-native-otp-verify');
    } catch {
      OtpVerify = null;
    }
    if (!OtpVerify) return;
    try {
      const hashes = (await OtpVerify.getHash?.()) ?? [];
      if (hashes.length) {
        const originalHash = hashes[0];
        const safeHash = encodeURIComponent(originalHash);
        appHashRef.current = safeHash;
        if (__DEV__) {
          console.log('🔐 Android Original Hash Key:', originalHash);
          console.log('✅ Android Safe Hash Key (encoded):', safeHash);
        }
      }
    } catch (err) {
      if (__DEV__) console.warn('[OTP] Failed to get hash', err);
    }
    try {
      // Clean up any stale listener before registering a fresh one, just
      // in case removeListener wasn't called on the previous teardown.
      try {
        OtpVerify.removeListener?.();
      } catch {}

      OtpVerify.startOtpListener?.((msg: string) => {
        const code = extractOTP(msg) ?? '';
        if (!code) return;
        setOtp(code);
        const anyRef = otpRef.current as any;
        if (anyRef?.setValue) anyRef.setValue(code);
        submitOnce(code, 'android_sms_listener');
      });

      listenerActiveRef.current = true;

      cleanupOtpListenerRef.current = () => {
        try {
          OtpVerify?.removeListener?.();
        } catch {}
        listenerActiveRef.current = false;
      };
    } catch (err) {
      if (__DEV__) console.warn('[OTP] startOtpListener failed', err);
    }

    try {
      await OtpVerify.getOtp?.();
    } catch {}
  }, [submitOnce]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') startAndroidOtpPipelines();
    });
    return () => sub.remove();
  }, [startAndroidOtpPipelines]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let mounted = true;
    (async () => {
      await startAndroidOtpPipelines();
      if (!requestedInitialOtpRef.current) {
        for (let i = 0; i < 4 && mounted && !appHashRef.current; i++) {
          await new Promise(r => setTimeout(r, 400));
        }
        requestedInitialOtpRef.current = true;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [startAndroidOtpPipelines, dispatch, userId]);

  // ── iOS: re-focus when app comes back to foreground (e.g. user switches
  // to Messages app to copy the code manually, then returns) so the
  // QuickType bar has another chance to show the suggestion.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        if (iosFocusTimeoutRef.current)
          clearTimeout(iosFocusTimeoutRef.current);
        iosFocusTimeoutRef.current = setTimeout(() => {
          try {
            (otpRef.current as any)?.focus?.();
          } catch {}
        }, IOS_AUTOFOCUS_DELAY_MS);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Resend OTP — re-requests OTP (employee or vendor) ────────────────
  const handleResend = useCallback(() => {
    lastSubmittedCodeRef.current = null;
    lastSubmittedAtRef.current = 0;

    try {
      (otpRef.current as any)?.clear?.();
    } catch {}
    setOtp('');
    lastSubmittedCodeRef.current = null;
    lastSubmittedAtRef.current = 0;
    verifyingRef.current = false;
    startCountdown();
    const currentUserType = userTypeRef.current;
    if (__DEV__) console.log('[OTP] Resend — userType:', currentUserType);

    if (currentUserType === 'vendor') {
      dispatch(getVendorOtpApi({mobileNumber: userId, appType}));
    } else {
      dispatch(
        getOtpApi({
          mobileNumber: userId,
          hashKey: appHashRef.current ?? '',
          userType: currentUserType,
        }),
      );
    }

    // Re-trigger iOS QuickType focus after resend too, since a fresh SMS
    // is coming in and the field may have lost focus.
    if (Platform.OS === 'ios') {
      if (iosFocusTimeoutRef.current) clearTimeout(iosFocusTimeoutRef.current);
      iosFocusTimeoutRef.current = setTimeout(() => {
        try {
          (otpRef.current as any)?.focus?.();
        } catch {}
      }, IOS_AUTOFOCUS_DELAY_MS);
    }
  }, [startCountdown, dispatch, userId, appType]);

  // ── Animated progress bar width ───────────────────────────────────────
  const progressBarWidth = timerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Screen
      preset="scroll"
      loading={loading}
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle={'dark'}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={[styles.view, styles.viewFlexBox]}>
          <View style={[styles.headline, styles.viewFlexBox]}>
            <Image
              source={IMAGES.appLogo}
              style={styles.logoSm1Icon}
              resizeMode="cover"
            />
            <View style={[styles.text, styles.viewFlexBox]}>
              <Text style={styles.signInTo}>Sign in to your Account</Text>
              <Text style={styles.enterYourPhone}>
                {`Enter your phone number to log in `}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Phone number display ──────────────────────────────────────── */}
        <View style={styles.fieldParent}>
          <View style={styles.field}>
            <View style={styles.inputField}>
              <InputField
                title={'Phone'}
                type={'loginMobile'}
                value={userId}
                placeholder={t('placeholder.enter_mobile')}
                maxLength={10}
                isRequired
                keyboardType={'number-pad'}
                textContentType={'oneTimeCode'}
                inputStyle={{height: SIZE.MVS(45)}}
                onEndEditing={() => Keyboard.dismiss()}
              />
            </View>
          </View>
        </View>

        {/* ── iOS debug info ────────────────────────────────────────────── */}
        {Platform.OS === 'ios' && (
          <Text style={styles.keyboardCode}>
            {`APNs: ${apnsToken ? 'OK' : 'pending'} · FCM: ${
              fcmToken ? 'OK' : 'pending'
            } · Autofill enabled`}
          </Text>
        )}

        {/* ── OTP label ─────────────────────────────────────────────────── */}
        <Text style={styles.otpLabel}>OTP</Text>

        {/* ── OTP Input ─────────────────────────────────────────────────── */}
        <View style={styles.inputContainer}>
          <OtpInput
            ref={otpRef}
            numberOfDigits={6}
            focusColor={COLORS.PRIMARY}
            // iOS needs the keyboard open on mount so the QuickType
            // "oneTimeCode" suggestion bar shows up without the user
            // having to manually tap the field first. Android keeps its
            // own SMS-listener-driven autofill, so no need to force focus
            // there (and forcing it there has no effect on the listener
            // anyway).
            autoFocus={Platform.OS === 'ios'}
            hideStick
            placeholder="＊＊＊＊＊＊"
            blurOnFilled={false}
            onTextChange={handleOtpTextChange}
            onFilled={(code: string) => {
              submitOnce(code, 'otp_filled');
            }}
            type="numeric"
            secureTextEntry={false}
            focusStickBlinkingDuration={0}
            textInputProps={{
              accessibilityLabel: 'One-Time Password',
              autoComplete:
                Platform.OS === 'android' ? 'sms-otp' : 'one-time-code',
              keyboardType: 'number-pad',
              textContentType: Platform.OS === 'ios' ? 'oneTimeCode' : 'none',
              editable: true,
              showSoftInputOnFocus: true,
              caretHidden: false,
              returnKeyType: 'done',
              blurOnSubmit: false,
            }}
            theme={{
              containerStyle: styles.otpContainer,
              pinCodeContainerStyle: styles.pinBox,
              pinCodeTextStyle: styles.pinCodeText,
              placeholderTextStyle: styles.placeholderText,
              filledPinCodeContainerStyle: styles.filledPinCodeContainer,
            }}
          />
        </View>

        {/* ── Resend OTP ────────────────────────────────────────────────── */}
        <View style={styles.resendContainer}>
          <Text
            style={[styles.resendText, resendDisabled && {opacity: 0.5}]}
            onPress={!resendDisabled ? handleResend : undefined}>
            {resendDisabled ? t('resend_after') : t('resend_code')}
            {timerCount > 0 && (
              <Text style={styles.timerText}> {timerCount}</Text>
            )}
            {resendDisabled && timerCount > 0 ? ' sec' : ''}
          </Text>
        </View>

        {/* ── Android SMS auto-fill loader ──────────────────────────────── */}
        {ENABLE_AUTO_SMS && fetchingOtp && Platform.OS === 'android' && (
          <View style={styles.otpLoader}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY_DARK} />
            <Text style={styles.waitingText}>
              {'Waiting for OTP to Auto fill'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Text style={styles.gigatelTechnosoftPvt}>
        Gigatel Technosoft Pvt Ltd
      </Text>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.login.loading === 'pending',
});
export default connect(MapStateToProps)(OtpVerification);

const styles = StyleSheet.create({
  scroll: {flex: 1},
  viewFlexBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  view: {
    width: '100%',
    paddingTop: SIZE.MS(65),
    gap: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    flex: 1,
  },
  headline: {
    gap: 24,
    justifyContent: 'center',
  },
  logoSm1Icon: {
    width: 41,
    height: 41,
  },
  text: {
    width: 341,
    gap: 12,
    justifyContent: 'center',
  },
  signInTo: {
    fontSize: SIZE.MS(30),
    letterSpacing: -0.8,
    fontFamily: FONTS.SEMI_BOLD,
    lineHeight: 42,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  enterYourPhone: {
    fontSize: SIZE.MS(12),
    lineHeight: 17,
    textAlign: 'left',
    fontWeight: '500',
    letterSpacing: -0.1,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  fieldParent: {
    marginTop: SIZE.MS(30),
    alignSelf: 'stretch',
  },
  field: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
  },
  inputField: {
    gap: 10,
    alignSelf: 'stretch',
  },
  keyboardCode: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(10),
    color: COLORS.TEXT_MEDIUM,
    marginHorizontal: SIZE.MS(15),
    textAlign: 'center',
    marginTop: SIZE.MVS(5),
  },
  progressBarContainer: {
    height: SIZE.MVS(6),
    backgroundColor: COLORS.BORDER_DEFAULT,
    marginHorizontal: SIZE.MS(25),
    marginTop: SIZE.MVS(20),
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 3,
  },
  timerLabel: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(13),
    color: COLORS.colorDarkslategray,
    marginHorizontal: SIZE.MS(25),
    marginTop: SIZE.MVS(8),
    textAlign: 'center',
  },
  otpLabel: {
    marginHorizontal: SIZE.MS(32),
    marginVertical: SIZE.MVS(10),
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MS(14),
    color: COLORS.colorDarkslategray,
  },
  inputContainer: {
    height: SIZE.MVS(60),
    borderRadius: SIZE.MS(6),
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: SIZE.MS(25),
    alignItems: 'center',
  },
  otpContainer: {
    width: '96%',
    alignSelf: 'center',
    marginLeft: 6,
  },
  pinBox: {
    width: SIZE.MS(45),
    height: SIZE.MS(48),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.BORDER_DEFAULT,
    backgroundColor: COLORS.WHITE,
  },
  pinCodeText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(12),
    color: COLORS.TEXT_DARK,
  },
  placeholderText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(14),
    color: COLORS.TEXT_PLACEHOLDER,
  },
  filledPinCodeContainer: {
    borderColor: COLORS.BORDER_DEFAULT,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SIZE.MS(30),
    gap: SIZE.MS(6),
  },
  resendText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(15),
    color: COLORS.PRIMARY,
  },
  timerText: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MVS(15),
    color: COLORS.ERROR,
  },
  otpLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZE.MVS(10),
  },
  waitingText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(15),
    color: COLORS.PRIMARY_DARK,
    marginLeft: SIZE.MS(15),
  },
  gigatelTechnosoftPvt: {
    bottom: 10,
    alignSelf: 'center',
    position: 'absolute',
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
  },
});
