import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ScrollView,
    ActivityIndicator,
    ImageBackground,
    Keyboard,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
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

// UI only: the "check your email" confirmation is shown as a success note.
const SUCCESS_PREFIX = 'Your account has been created';

type FormErrors = {
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
};

type ScrollViewRef = React.ComponentRef<typeof ScrollView>;
type TextInputRef = React.ComponentRef<typeof TextInput>;

type FieldKey =
    | 'fullName'
    | 'email'
    | 'phone'
    | 'password'
    | 'confirmPassword';

const FIELD_ORDER: FieldKey[] = [
    'fullName',
    'email',
    'phone',
    'password',
    'confirmPassword',
];

type IconName = 'user' | 'mail' | 'phone' | 'lock' | 'check';

function Icon({
    name,
    size = 20,
    color = COLORS.muted,
}: {
    name: IconName;
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
            {name === 'user' && (
                <>
                    <Circle cx={12} cy={8} r={4} {...common} />
                    <Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" {...common} />
                </>
            )}
            {name === 'mail' && (
                <>
                    <Rect x={3} y={5} width={18} height={14} rx={2} {...common} />
                    <Path d="M3 7l9 6 9-6" {...common} />
                </>
            )}
            {name === 'phone' && (
                <Path
                    d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9z"
                    {...common}
                />
            )}
            {name === 'lock' && (
                <>
                    <Rect x={5} y={11} width={14} height={9} rx={2} {...common} />
                    <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...common} />
                </>
            )}
            {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...common} />}
        </Svg>
    );
}

export default function RegisterScreen() {
    const insets = useSafeAreaInsets();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // UI-only state: keyboard handling and input focus styling.
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [focused, setFocused] = useState<FieldKey | null>(null);
    const focusedRef = useRef<FieldKey | null>(null);
    const scrollRef = useRef<ScrollViewRef>(null);
    const inputRefs = useRef<Record<string, TextInputRef | null>>({});
    const sheetY = useRef(0);
    const fieldY = useRef<Record<string, number>>({});

    const scrollToField = (key: FieldKey | null) => {
        if (!key) return;

        scrollRef.current?.scrollTo({
            y: Math.max(0, sheetY.current + (fieldY.current[key] ?? 0) - 90),
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
            setTimeout(() => scrollToField(focusedRef.current), 120);
        });

        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const normalizePhone = (value: string) => {
        const cleaned = value.replace(/[\s-]/g, '');

        if (cleaned.startsWith('+254')) {
            return cleaned;
        }

        if (cleaned.startsWith('0')) {
            return `+254${cleaned.substring(1)}`;
        }

        return cleaned;
    };

    const validateForm = () => {
        const newErrors: FormErrors = {};

        if (fullName.trim().length < 3) {
            newErrors.fullName = 'Please enter your full name.';
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email.trim())) {
            newErrors.email = 'Please enter a valid email address.';
        }

        const normalizedPhone = normalizePhone(phone);

        if (!/^\+254[17]\d{8}$/.test(normalizedPhone)) {
            newErrors.phone = 'Enter a valid Kenyan mobile number.';
        }

        if (password.length < 8) {
            newErrors.password = 'Password must contain at least 8 characters.';
        }

        if (confirmPassword !== password) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }

        if (!acceptedTerms) {
            newErrors.terms = 'Please accept the terms to continue.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        setMessage('');

        if (!validateForm()) return;

        setLoading(true);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedPhone = normalizePhone(phone);

            const { data, error } = await supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        phone: normalizedPhone,
                    },
                },
            });

            if (error) {
                throw error;
            }

            if (!data.user) {
                setMessage(
                    'We could not complete your registration. Please try again.'
                );
                return;
            }

            // Supabase may require email confirmation before creating a session.
            if (!data.session) {
                setMessage(
                    'Your account has been created. Please check your email and confirm your address before logging in.'
                );
                return;
            }

            // A session exists, so the parent can continue to school selection.
            router.replace('/(auth)/select-school');
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Something went wrong during registration. Please try again.';

            setMessage(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (
        key: FieldKey,
        icon: IconName,
        label: string,
        placeholder: string,
        value: string,
        setter: (value: string) => void,
        error?: string,
        options?: {
            keyboardType?: 'default' | 'email-address' | 'phone-pad';
            secure?: boolean;
            visible?: boolean;
            toggleVisibility?: () => void;
            autoCapitalize?: 'none' | 'words' | 'sentences';
            autoComplete?:
            | 'name'
            | 'email'
            | 'tel'
            | 'password-new';
        }
    ) => {
        const isFocused = focused === key;
        const index = FIELD_ORDER.indexOf(key);
        const isLast = index === FIELD_ORDER.length - 1;

        return (
            <View
                style={styles.field}
                onLayout={(event) => {
                    fieldY.current[key] = event.nativeEvent.layout.y;
                }}
            >
                <Text style={styles.label}>{label}</Text>

                <View
                    style={[
                        styles.inputContainer,
                        isFocused && styles.inputFocused,
                        !!error && styles.inputError,
                    ]}
                >
                    <Icon
                        name={icon}
                        color={
                            error
                                ? COLORS.red
                                : isFocused
                                    ? COLORS.blue
                                    : COLORS.muted
                        }
                    />

                    <TextInput
                        ref={(node) => {
                            inputRefs.current[key] = node;
                        }}
                        style={styles.input}
                        placeholder={placeholder}
                        placeholderTextColor="#9CA3AF"
                        value={value}
                        onChangeText={setter}
                        keyboardType={options?.keyboardType ?? 'default'}
                        secureTextEntry={options?.secure && !options?.visible}
                        autoCapitalize={options?.autoCapitalize ?? 'none'}
                        autoCorrect={false}
                        autoComplete={options?.autoComplete}
                        returnKeyType={isLast ? 'done' : 'next'}
                        blurOnSubmit={isLast}
                        onSubmitEditing={() => {
                            if (!isLast) {
                                inputRefs.current[FIELD_ORDER[index + 1]]?.focus();
                            }
                        }}
                        onFocus={() => {
                            focusedRef.current = key;
                            setFocused(key);
                            setTimeout(() => scrollToField(key), 120);
                        }}
                        onBlur={() => {
                            setFocused((current) =>
                                current === key ? null : current
                            );
                        }}
                        editable={!loading}
                        accessibilityLabel={label}
                    />

                    {options?.toggleVisibility && (
                        <TouchableOpacity
                            onPress={options.toggleVisibility}
                            style={styles.visibilityButton}
                            accessibilityRole="button"
                            accessibilityLabel={
                                options.visible ? 'Hide password' : 'Show password'
                            }
                        >
                            <Text style={styles.visibilityText}>
                                {options.visible ? 'HIDE' : 'SHOW'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {!!error && (
                    <Text
                        style={styles.errorText}
                        accessibilityLiveRegion="polite"
                    >
                        {error}
                    </Text>
                )}
            </View>
        );
    };

    const isSuccessMessage = message.startsWith(SUCCESS_PREFIX);

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

                <View style={styles.header}>
                    <View style={styles.logoMark}>
                        <Text style={styles.logoLetter}>S</Text>
                    </View>

                    <Text style={styles.brandName}>SchoolView</Text>
                </View>

            </ImageBackground>

            {/* Form sheet */}
            <View
                style={[
                    styles.sheet,
                    { paddingBottom: Math.max(insets.bottom, 20) + 10 },
                ]}
                onLayout={(event) => {
                    sheetY.current = event.nativeEvent.layout.y;
                }}
            >
                <View style={styles.heading}>
                    <Text style={styles.eyebrow}>PARENT ACCOUNT</Text>

                    <Text style={styles.title}>Create your account</Text>

                    <Text style={styles.subtitle}>
                        Stay connected with your child's school and follow
                        their classroom journey.
                    </Text>
                </View>

                <Text style={styles.sectionTitle}>Your details</Text>

                {renderInput(
                    'fullName',
                    'user',
                    'Full name',
                    'Enter your full name',
                    fullName,
                    setFullName,
                    errors.fullName,
                    { autoCapitalize: 'words', autoComplete: 'name' }
                )}

                {renderInput(
                    'email',
                    'mail',
                    'Email address',
                    'example@email.com',
                    email,
                    setEmail,
                    errors.email,
                    { keyboardType: 'email-address', autoComplete: 'email' }
                )}

                {renderInput(
                    'phone',
                    'phone',
                    'Phone number',
                    '+254 7XX XXX XXX',
                    phone,
                    setPhone,
                    errors.phone,
                    { keyboardType: 'phone-pad', autoComplete: 'tel' }
                )}

                <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
                    Secure your account
                </Text>

                {renderInput(
                    'password',
                    'lock',
                    'Password',
                    'Create a strong password',
                    password,
                    setPassword,
                    errors.password,
                    {
                        secure: true,
                        visible: showPassword,
                        toggleVisibility: () => setShowPassword(!showPassword),
                        autoComplete: 'password-new',
                    }
                )}

                {renderInput(
                    'confirmPassword',
                    'lock',
                    'Confirm password',
                    'Enter your password again',
                    confirmPassword,
                    setConfirmPassword,
                    errors.confirmPassword,
                    {
                        secure: true,
                        visible: showConfirmPassword,
                        toggleVisibility: () =>
                            setShowConfirmPassword(!showConfirmPassword),
                        autoComplete: 'password-new',
                    }
                )}

                {/* Terms */}
                <TouchableOpacity
                    style={styles.termsRow}
                    onPress={() => setAcceptedTerms(!acceptedTerms)}
                    activeOpacity={0.8}
                    disabled={loading}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: acceptedTerms }}
                    accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
                >
                    <View
                        style={[
                            styles.checkbox,
                            acceptedTerms && styles.checkboxActive,
                            !!errors.terms && !acceptedTerms && styles.inputError,
                        ]}
                    >
                        {acceptedTerms && (
                            <Icon name="check" size={14} color={COLORS.white} />
                        )}
                    </View>

                    <Text style={styles.termsText}>
                        I agree to the{' '}
                        <Text style={styles.linkText}>Terms of Service</Text>
                        {' '}and{' '}
                        <Text style={styles.linkText}>Privacy Policy</Text>.
                    </Text>
                </TouchableOpacity>

                {!!errors.terms && (
                    <Text style={styles.errorText}>{errors.terms}</Text>
                )}

                {/* Submit */}
                <TouchableOpacity
                    style={[
                        styles.registerButton,
                        loading && styles.buttonDisabled,
                    ]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Create account"
                >
                    {loading ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <Text style={styles.registerButtonText}>
                            Create account
                        </Text>
                    )}
                </TouchableOpacity>

                {!!message && (
                    <View
                        style={[
                            styles.messageBox,
                            isSuccessMessage
                                ? styles.messageSuccess
                                : styles.messageError,
                        ]}
                        accessibilityRole="alert"
                    >
                        {isSuccessMessage && (
                            <View style={styles.messageIcon}>
                                <Icon
                                    name="check"
                                    size={18}
                                    color={COLORS.green}
                                />
                            </View>
                        )}
                        <Text
                            style={[
                                styles.messageText,
                                {
                                    color: isSuccessMessage
                                        ? COLORS.charcoal
                                        : COLORS.red,
                                },
                            ]}
                        >
                            {message}
                        </Text>
                    </View>
                )}

                {/* Login navigation */}
                <View style={styles.loginRow}>
                    <Text style={styles.loginText}>
                        Already have an account?
                    </Text>

                    <Link href="/(auth)/login" asChild>
                        <TouchableOpacity
                            disabled={loading}
                            style={styles.loginLinkButton}
                            accessibilityRole="link"
                            accessibilityLabel="Log in"
                        >
                            <Text style={styles.loginLink}> Log in</Text>
                        </TouchableOpacity>
                    </Link>
                </View>

                <Text style={styles.footer}>
                    SCHOOLVIEW · CONNECTING SCHOOLS AND FAMILIES
                </Text>
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

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    logoMark: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: COLORS.blue,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    logoLetter: {
        color: COLORS.white,
        fontSize: 26,
        fontFamily: FONTS.heading,
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
        paddingTop: 24,
        gap: 16,
    },

    sectionTitle: {
        color: COLORS.charcoal,
        fontSize: 20,
        fontFamily: FONTS.heading,
    },

    sectionSpacing: {
        marginTop: 8,
    },

    field: {
        gap: 8,
    },

    label: {
        color: COLORS.charcoal,
        fontSize: 14,
        fontFamily: FONTS.bodyBold,
    },

    inputContainer: {
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingLeft: 14,
        paddingRight: 6,
        gap: 10,
    },

    inputFocused: {
        borderColor: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
    },

    inputError: {
        borderColor: COLORS.red,
    },

    input: {
        flex: 1,
        height: 52,
        color: COLORS.charcoal,
        fontSize: 15,
        fontFamily: FONTS.bodyMedium,
        paddingVertical: 0,
    },

    visibilityButton: {
        minWidth: 52,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },

    visibilityText: {
        color: COLORS.blue,
        fontSize: 12,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 0.5,
    },

    errorText: {
        color: COLORS.red,
        fontSize: 12.5,
        fontFamily: FONTS.bodyMedium,
    },

    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 44,
    },

    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },

    checkboxActive: {
        backgroundColor: COLORS.blue,
        borderColor: COLORS.blue,
    },

    termsText: {
        flex: 1,
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.body,
    },

    linkText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
    },

    registerButton: {
        minHeight: 52,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },

    buttonDisabled: {
        opacity: 0.7,
    },

    registerButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontFamily: FONTS.bodyBold,
    },

    messageBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 13,
        borderRadius: 12,
    },

    messageError: {
        backgroundColor: COLORS.redSoft,
    },

    messageSuccess: {
        backgroundColor: COLORS.greenSoft,
    },

    messageIcon: {
        marginRight: 10,
        marginTop: 1,
    },

    messageText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.bodyMedium,
    },

    loginRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },

    loginText: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.body,
    },

    loginLinkButton: {
        minHeight: 44,
        justifyContent: 'center',
    },

    loginLink: {
        color: COLORS.blue,
        fontSize: 14,
        fontFamily: FONTS.bodyBold,
    },

    footer: {
        color: COLORS.muted,
        textAlign: 'center',
        fontSize: 10,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 1,
        marginTop: 6,
        opacity: 0.8,
    },
});