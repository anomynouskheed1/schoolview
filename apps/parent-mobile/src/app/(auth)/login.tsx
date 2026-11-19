import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    ActivityIndicator,
    ImageBackground,
    Keyboard,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { supabase } from '@/lib/supabase';

const COLORS = {
    blue: '#1683C5',
    charcoal: '#292D32',
    paleBlue: '#E8F5FC',
    white: '#FFFFFF',
    muted: '#6B7280',
    border: '#E4E8EC',
    green: '#16A34A',
    greenSoft: '#E7F6EC',
    red: '#D92D20',
    redSoft: '#FDECEA',
    greySoft: '#F1F3F5',
};

const FONTS = {
    heading: 'Fredoka_600SemiBold',
    serif: 'PlayfairDisplay_500Medium',
    body: 'Nunito_400Regular',
    bodyMedium: 'Nunito_600SemiBold',
    bodyBold: 'Nunito_700Bold',
};

function Icon({
    name,
    size = 20,
    color = COLORS.muted,
}: {
    name: 'mail' | 'lock';
    size?: number;
    color?: string;
}) {
    const common = {
        stroke: color,
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        fill: 'none',
    };

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            {name === 'mail' && (
                <>
                    <Rect x={3} y={5} width={18} height={14} rx={2} {...common} />
                    <Path d="M3 7l9 6 9-6" {...common} />
                </>
            )}
            {name === 'lock' && (
                <>
                    <Rect x={5} y={11} width={14} height={9} rx={2} {...common} />
                    <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...common} />
                </>
            )}
        </Svg>
    );
}

type ScrollViewRef = React.ComponentRef<typeof ScrollView>;
type TextInputRef = React.ComponentRef<typeof TextInput>;

export default function LoginScreen() {
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // UI-only state: keyboard handling and input focus styling.
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [focused, setFocused] = useState<'email' | 'password' | null>(null);
    const scrollRef = useRef<ScrollViewRef>(null);
    const passwordRef = useRef<TextInputRef>(null);
    const sheetY = useRef(0);
    const emailFieldY = useRef(0);

    const scrollFieldsIntoView = () => {
        scrollRef.current?.scrollTo({
            y: Math.max(0, sheetY.current + emailFieldY.current - 90),
            animated: true,
        });
    };

    useEffect(() => {
        const showEvent =
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent =
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event.endCoordinates.height);
            setTimeout(scrollFieldsIntoView, 120);
        });

        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const handleLogin = async () => {
        setMessage('');

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setMessage('Please enter a valid email address.');
            return;
        }

        if (!password) {
            setMessage('Please enter your password.');
            return;
        }

        setLoading(true);

        try {
            const { data, error } =
                await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error('Unable to retrieve your account.');
            }

            // Check the parent's existing child-link requests.
            const { data: relationships, error: relationshipError } =
                await supabase
                    .from('parent_students')
                    .select('status')
                    .eq('parent_id', data.user.id);

            if (relationshipError) {
                throw relationshipError;
            }

            const hasApprovedLink = relationships?.some(
                (item) => item.status === 'approved'
            );

            const hasPendingLink = relationships?.some(
                (item) => item.status === 'pending'
            );

            if (hasApprovedLink) {
                router.replace('/(parent)');
            } else if (hasPendingLink) {
                router.replace('/(auth)/pending_approval');
            } else {
                router.replace('/(auth)/select-school');
            }
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Something went wrong. Please try again.';

            setMessage(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const keyboardOpen = keyboardHeight > 0;

    return (
        <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: keyboardHeight },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
        >
            {/* Photo header */}
            <ImageBackground
                source={require('@/assets/images/schoolview-auth-background.jpg')}
                style={[styles.hero, { paddingTop: insets.top + 16 }]}
                resizeMode="cover"
            >
                <View style={styles.heroOverlay} />

                <View style={styles.brand}>
                    <Text style={styles.brandName}>SchoolView</Text>
                </View>

            </ImageBackground>

            {/* Form sheet */}
            <View
                style={[
                    styles.sheet,
                    { paddingBottom: Math.max(insets.bottom, 16) + 10 },
                ]}
                onLayout={(event) => {
                    sheetY.current = event.nativeEvent.layout.y;
                }}
            >
                <View style={styles.heading}>
                    <Text style={styles.eyebrow}>WELCOME BACK</Text>

                    <Text style={styles.title}>Log in to your account</Text>

                    <Text style={styles.subtitle}>
                        Stay connected with your child's school.
                    </Text>
                </View>

                <View
                    style={styles.field}
                    onLayout={(event) => {
                        emailFieldY.current = event.nativeEvent.layout.y;
                    }}
                >
                    <Text style={styles.label}>Email address</Text>

                    <View
                        style={[
                            styles.inputWrap,
                            focused === 'email' && styles.inputFocused,
                        ]}
                    >
                        <Icon
                            name="mail"
                            color={
                                focused === 'email' ? COLORS.blue : COLORS.muted
                            }
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="example@email.com"
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => passwordRef.current?.focus()}
                            onFocus={() => setFocused('email')}
                            onBlur={() => setFocused(null)}
                            editable={!loading}
                            accessibilityLabel="Email address"
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Password</Text>

                    <View
                        style={[
                            styles.inputWrap,
                            focused === 'password' && styles.inputFocused,
                        ]}
                    >
                        <Icon
                            name="lock"
                            color={
                                focused === 'password'
                                    ? COLORS.blue
                                    : COLORS.muted
                            }
                        />
                        <TextInput
                            ref={passwordRef}
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="password"
                            textContentType="password"
                            returnKeyType="go"
                            onSubmitEditing={handleLogin}
                            onFocus={() => {
                                setFocused('password');
                                setTimeout(scrollFieldsIntoView, 120);
                            }}
                            onBlur={() => setFocused(null)}
                            editable={!loading}
                            accessibilityLabel="Password"
                        />

                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            disabled={loading}
                            style={styles.showButton}
                            accessibilityRole="button"
                            accessibilityLabel={
                                showPassword ? 'Hide password' : 'Show password'
                            }
                        >
                            <Text style={styles.showText}>
                                {showPassword ? 'HIDE' : 'SHOW'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Log in"
                >
                    {loading ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <Text style={styles.buttonText}>Log in</Text>
                    )}
                </TouchableOpacity>

                {!!message && (
                    <View style={styles.messageBox} accessibilityRole="alert">
                        <Text style={styles.message}>{message}</Text>
                    </View>
                )}

                <View style={styles.bottom}>
                    <Text style={styles.muted}>Don't have an account?</Text>

                    <Link href="/(auth)/register" style={styles.link}>
                        {' '}Create account
                    </Link>
                </View>

                {!keyboardOpen && (
                    <>
                        <View style={styles.spacer} />
                        <Text style={styles.footer}>
                            SCHOOLVIEW · CONNECTING SCHOOLS AND FAMILIES
                        </Text>
                    </>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    scrollContent: {
        flexGrow: 1,
    },

    hero: {
        paddingHorizontal: 24,
        paddingBottom: 190,
        overflow: 'hidden',
    },

    heroOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(22, 131, 197, 0.38)',
    },

    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    brandName: {
        color: COLORS.white,
        fontSize: 26,
        fontFamily: FONTS.heading,
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },

    heading: {
        gap: 2,
        marginBottom: 4,
    },

    eyebrow: {
        color: COLORS.blue,
        fontSize: 12,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 1.6,
    },

    title: {
        color: COLORS.charcoal,
        fontSize: 28,
        fontFamily: FONTS.heading,
    },

    subtitle: {
        color: COLORS.muted,
        fontSize: 14,
        lineHeight: 21,
        fontFamily: FONTS.serif,
        marginTop: 2,
    },

    sheet: {
        flexGrow: 1,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: -28,
        paddingHorizontal: 22,
        paddingTop: 26,
        gap: 16,
    },

    field: {
        gap: 8,
    },

    label: {
        color: COLORS.charcoal,
        fontSize: 14,
        fontFamily: FONTS.bodyBold,
    },

    inputWrap: {
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingLeft: 14,
        paddingRight: 6,
        gap: 10,
    },

    inputFocused: {
        borderColor: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
    },

    input: {
        flex: 1,
        height: 52,
        color: COLORS.charcoal,
        fontSize: 15,
        fontFamily: FONTS.bodyMedium,
        paddingVertical: 0,
    },

    showButton: {
        minWidth: 52,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },

    showText: {
        color: COLORS.blue,
        fontSize: 12,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 0.5,
    },

    button: {
        minHeight: 52,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },

    buttonDisabled: {
        opacity: 0.7,
    },

    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontFamily: FONTS.bodyBold,
    },

    messageBox: {
        backgroundColor: COLORS.redSoft,
        borderRadius: 12,
        padding: 12,
    },

    message: {
        color: COLORS.red,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.bodyMedium,
    },

    bottom: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 6,
    },

    muted: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.body,
    },

    link: {
        color: COLORS.blue,
        fontSize: 14,
        fontFamily: FONTS.bodyBold,
    },

    spacer: {
        flexGrow: 1,
        minHeight: 8,
    },

    footer: {
        color: COLORS.muted,
        textAlign: 'center',
        fontSize: 10,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 1,
        opacity: 0.8,
    },
});