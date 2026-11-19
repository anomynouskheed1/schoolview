import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

const BLUE = '#082D63';
const BRIGHT_BLUE = '#0066E8';
const WHITE = '#FFFFFF';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Image */}
      <Image
        source={require('../../assets/images/welcome-photo.jpg')}
        style={styles.backgroundPhoto}
        resizeMode="cover"
      />

      {/* Dark Blue Overlay Gradient */}
      <Svg
        style={styles.gradientOverlay}
        viewBox="0 0 400 900"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient
            id="welcomeShade"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={BLUE} stopOpacity="0.95" />
            <Stop offset="25%" stopColor={BLUE} stopOpacity="0.75" />
            <Stop offset="50%" stopColor={BLUE} stopOpacity="0.30" />
            <Stop offset="75%" stopColor={BLUE} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>
        <Path d="M0 0 H400 V900 H0 Z" fill="url(#welcomeShade)" />
      </Svg>

      {/* Branding Header */}
      <SafeAreaView style={styles.contentContainer}>
        <View style={styles.branding}>
          <Svg width={82} height={66} viewBox="0 0 90 65">
            <Circle cx="45" cy="13" r="10" fill={WHITE} />
            <Path
              d="M8 32 L38 43 L45 52 L52 43 L82 32 L45 59 Z"
              fill={WHITE}
            />
            <Path
              d="M12 27 L38 38 M78 27 L52 38"
              stroke={WHITE}
              strokeWidth="5"
              strokeLinecap="round"
            />
          </Svg>

          <Text style={styles.brandName}>SchoolView</Text>

          <Text style={styles.tagline}>
            Stay Connected.{"\n"}See Their World.
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom White Section with Wave */}
      <View style={styles.bottomSection}>
        <View style={styles.waveContainer}>
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 400 50"
            preserveAspectRatio="none"
          >
            <Path
              d="M0 25 C 120 50, 280 0, 400 25 L 400 50 L 0 50 Z"
              fill={WHITE}
            />
          </Svg>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryButtonText}>
              Get Started
            </Text>
          </Pressable>

          <Pressable
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
  },
  backgroundPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '78%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '60%',
  },
  contentContainer: {
    flex: 1,
  },
  branding: {
    alignItems: 'center',
    marginTop: 20,
  },
  brandName: {
    color: WHITE,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 6,
  },
  tagline: {
    color: WHITE,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
  },
  waveContainer: {
    width: '100%',
    height: 40,
    backgroundColor: 'transparent',
    marginTop: -39,
  },
  footer: {
    backgroundColor: WHITE,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 0,
    paddingBottom: 40,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: BRIGHT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  signInText: {
    color: BRIGHT_BLUE,
    fontSize: 15,
    fontWeight: '700',
  },
});