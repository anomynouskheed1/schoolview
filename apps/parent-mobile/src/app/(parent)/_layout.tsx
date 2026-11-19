import { Tabs } from 'expo-router';
import { View, ColorValue, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useFonts } from 'expo-font';
import {
    Fredoka_500Medium,
    Fredoka_600SemiBold,
} from '@expo-google-fonts/fredoka';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display';
import {
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
} from '@expo-google-fonts/nunito';

/* -------------------------------------------------------------------------- */
/*  Design tokens                                                             */
/* -------------------------------------------------------------------------- */

const COLORS = {
    blue: '#1683C5',
    inactive: '#6B7280',
    white: '#FFFFFF',
    border: '#E4E8EC',
};

const TAB_CONTENT_HEIGHT = 62;

type TabIconProps = {
    name: string;
    color: ColorValue;
    focused: boolean;
};

function TabIcon({ name, color, focused }: TabIconProps) {
    const strokeWidth = focused ? 2.2 : 1.8;

    return (
        <View
            style={{
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Svg
                width={26}
                height={26}
                viewBox="0 0 24 24"
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {name === 'index' && (
                    <>
                        <Path d="M3 10.5 12 3l9 7.5" />
                        <Path d="M5.5 9.5V21h13V9.5" />
                        <Path d="M9 21v-7h6v7" />
                    </>
                )}

                {name === 'live' && (
                    <>
                        <Rect x="3" y="6" width="18" height="13" rx="2.5" />
                        <Path d="m10 10 5 2.5-5 2.5z" />
                        <Path d="M7 3.5h10" />
                    </>
                )}

                {name === 'announcements' && (
                    <>
                        <Path d="M3 10v4h4l10 5V5L7 10H3Z" />
                        <Path d="m7 14 2 6h4l-3-5" />
                        <Path d="M20 9c1 1.5 1 4.5 0 6" />
                    </>
                )}

                {name === 'profile' && (
                    <>
                        <Circle cx="12" cy="8" r="4" />
                        <Path d="M4 21c.5-4.2 3.5-6.5 8-6.5s7.5 2.3 8 6.5" />
                    </>
                )}
            </Svg>
        </View>
    );
}

export default function ParentLayout() {
    const insets = useSafeAreaInsets();

    // Load the three app fonts once. The app keeps rendering if loading
    // fails, falling back to the system font rather than a blank screen.
    const [fontsLoaded, fontError] = useFonts({
        Fredoka_500Medium,
        Fredoka_600SemiBold,
        PlayfairDisplay_500Medium,
        Nunito_400Regular,
        Nunito_600SemiBold,
        Nunito_700Bold,
    });

    if (!fontsLoaded && !fontError) {
        return <View style={{ flex: 1, backgroundColor: COLORS.white }} />;
    }

    // Respect the home indicator / gesture bar instead of a fixed height.
    const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.white }}>
            {/* White screens, so the status bar icons must be dark */}
            <StatusBar style="dark" />

            <Tabs
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: COLORS.blue,
                    tabBarInactiveTintColor: COLORS.inactive,
                    tabBarHideOnKeyboard: true,
                    tabBarStyle: {
                        backgroundColor: COLORS.white,
                        borderTopWidth: 1,
                        borderTopColor: COLORS.border,
                        elevation: 0,
                        shadowOpacity: 0,
                        height: TAB_CONTENT_HEIGHT + bottomInset,
                        paddingTop: 8,
                        paddingBottom: bottomInset > 0 ? bottomInset : 8,
                    },
                    tabBarItemStyle: {
                        paddingVertical: 0,
                    },
                    tabBarLabelStyle: {
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 12,
                        marginTop: 2,
                    },
                    tabBarIcon: ({ color, focused }) => (
                        <TabIcon
                            name={route.name}
                            color={color}
                            focused={focused}
                        />
                    ),
                })}
            >
                <Tabs.Screen name="index" options={{ title: 'Home' }} />
                <Tabs.Screen
                    name="live"
                    options={{ title: 'Live Monitoring', tabBarLabel: 'Live' }}
                />
                <Tabs.Screen
                    name="announcements"
                    options={{ title: 'Announcements', tabBarLabel: 'Updates' }}
                />
                <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            </Tabs>
        </View>
    );
}