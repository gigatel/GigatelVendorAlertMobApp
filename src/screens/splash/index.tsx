import React, {useEffect, useRef} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONTS, IMAGES} from '@res';
const Splash = () => {
  const entrance = useRef(new Animated.Value(0)).current;
  const ambient = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    let motion: Animated.CompositeAnimation | undefined;
    const configureMotion = (reduceMotion: boolean) => {
      motion?.stop();
      entrance.stopAnimation();
      ambient.setValue(0);
      if (reduceMotion) {
        entrance.setValue(1);
        return;
      }
      Animated.timing(entrance, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      }).start();
      motion = Animated.loop(
        Animated.sequence([
          Animated.timing(ambient, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(ambient, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
      );
      motion.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(
      enabled => mounted && configureMotion(enabled),
      () => mounted && configureMotion(false),
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      configureMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
      entrance.stopAnimation();
      motion?.stop();
    };
  }, [entrance, ambient]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#F2F6FF" barStyle="dark-content" />
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible={false}>
        <View style={[styles.backgroundCircle, styles.lavenderCircle]} />
        <View style={[styles.backgroundCircle, styles.peachCircle]} />
        <Animated.View
          style={[
            styles.backgroundCircle,
            styles.topCircle,
            {
              transform: [
                {
                  translateY: ambient.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 24],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundCircle,
            styles.bottomCircle,
            {
              transform: [
                {
                  translateX: ambient.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Animated.View
            style={[
              styles.brand,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.logoStage}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.logoHalo,
                  {
                    opacity: ambient.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 0.75],
                    }),
                    transform: [
                      {
                        scale: ambient.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <View style={styles.logoCard}>
                <Image
                  source={IMAGES.logoWIthName}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityLabel="Gigatel"
                />
              </View>
            </View>
            <View style={styles.accentRow}>
              <View
                style={[styles.brandAccent, {backgroundColor: '#0CA2DD'}]}
              />
              <View
                style={[styles.brandAccent, {backgroundColor: '#8B6CE8'}]}
              />
              <View
                style={[styles.brandAccent, {backgroundColor: '#F5AC65'}]}
              />
            </View>
            <Text style={styles.tagline}>
              Underground Optical Fiber Network
            </Text>
          </Animated.View>
        </View>
        <View style={styles.footer}>
          <View
            accessibilityLabel="Loading application"
            accessibilityRole="progressbar"
            style={styles.loadingDots}>
            {[0, 1, 2].map(index => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {backgroundColor: ['#0CA2DD', '#8B6CE8', '#EE9471'][index]},
                  {
                    opacity: ambient.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: index === 1 ? [1, 0.35, 1] : [0.35, 1, 0.35],
                    }),
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.footerText}>Gigatel Technosoft Pvt Ltd</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};
export default Splash;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F6FF', overflow: 'hidden'},
  safeArea: {flex: 1, paddingTop: StatusBar.currentHeight ?? 0},
  backgroundCircle: {position: 'absolute', borderRadius: 300},
  lavenderCircle: {
    width: 260,
    height: 260,
    top: '25%',
    left: -190,
    backgroundColor: '#E1D7FA',
    opacity: 0.7,
  },
  peachCircle: {
    width: 210,
    height: 210,
    bottom: '14%',
    right: -140,
    backgroundColor: '#FFE2CC',
    opacity: 0.8,
  },
  topCircle: {
    width: 440,
    height: 440,
    top: -230,
    right: -220,
    backgroundColor: '#C4E5FC',
  },
  bottomCircle: {
    width: 360,
    height: 360,
    bottom: -200,
    left: -200,
    backgroundColor: '#BFEDE3',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  brand: {width: '100%', maxWidth: 340, alignItems: 'center'},
  logoStage: {
    width: '100%',
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHalo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#CFC8F5',
  },
  logoCard: {
    width: '100%',
    paddingHorizontal: 28,
    paddingVertical: 30,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE5FA',
    shadowColor: '#596AB4',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 3,
  },
  logo: {width: '100%', height: 64},
  accentRow: {flexDirection: 'row', gap: 5, marginTop: 24, marginBottom: 16},
  brandAccent: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.PRIMARY,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 21,
    fontFamily: FONTS.MEDIUM,
    color: '#667085',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 20,
  },
  loadingDots: {flexDirection: 'row', gap: 7, alignItems: 'center', height: 16},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.PRIMARY},
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.MEDIUM,
    color: '#667085',
    textAlign: 'center',
  },
});
