import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    TextInputProps,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { supabase } from '@/lib/supabase';

type Section = 'personal' | 'password' | 'email' | null;

/* -------------------------------------------------------------------------- */
/*  Design tokens (same as the other screens)                                 */
/* -------------------------------------------------------------------------- */

const COLORS = {
    blue: '#1683C5',
    charcoal: '#292D32',
    paleBlue: '#E8F5FC',
    white: '#FFFFFF',
    muted: '#6B7280',
    placeholder: '#9CA3AF',
    border: '#E4E8EC',
    red: '#D92D20',
};

const FONTS = {
    heading: 'Fredoka_600SemiBold',
    serif: 'PlayfairDisplay_500Medium',
    body: 'Nunito_400Regular',
    bodyMedium: 'Nunito_600SemiBold',
    bodyBold: 'Nunito_700Bold',
};

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

type IconName = 'back' | 'user' | 'lock' | 'mail' | 'phone' | 'chevron' | 'chevronDown';

function Icon({
    name,
    size = 22,
    color = COLORS.blue,
}: {
    name: IconName;
    size?: number;
    color?: string;
}) {
    const common = {
        fill: 'none',
        stroke: color,
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            {name === 'back' && <Path d="M15 18l-6-6 6-6" {...common} />}
            {name === 'chevron' && <Path d="M9 18l6-6-6-6" {...common} />}
            {name === 'chevronDown' && <Path d="M6 9l6 6 6-6" {...common} />}
            {name === 'user' && (
                <>
                    <Path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                        {...common}
                    />
                    <Circle cx={12} cy={7} r={4} {...common} />
                </>
            )}
            {name === 'lock' && (
                <>
                    <Rect x={3} y={11} width={18} height={11} rx={2} {...common} />
                    <Path d="M7 11V7a5 5 0 0 1 10 0v4" {...common} />
                </>
            )}
            {name === 'mail' && (
                <>
                    <Rect x={2} y={4} width={20} height={16} rx={2} {...common} />
                    <Path d="M22 7l-10 6L2 7" {...common} />
                </>
            )}
            {name === 'phone' && (
                <Path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
                    {...common}
                />
            )}
        </Svg>
    );
}

function SettingRow({
    icon,
    title,
    description,
    onPress,
    active,
    last = false,
}: {
    icon: IconName;
    title: string;
    description: string;
    onPress: () => void;
    active: boolean;
    last?: boolean;
}) {
    return (
        <Pressable
            style={[styles.row, !last && styles.divider]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ expanded: active }}
        >
            <View style={styles.rowIconCircle}>
                <Icon name={icon} size={18} />
            </View>

            <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowDescription}>{description}</Text>
            </View>

            <Icon
                name={active ? 'chevronDown' : 'chevron'}
                size={20}
                color={COLORS.charcoal}
            />
        </Pressable>
    );
}

function FormLabel({ children }: { children: string }) {
    return <Text style={styles.formLabel}>{children}</Text>;
}

// Same TextInput props as before; only adds a blue border while focused.
function FormInput(props: TextInputProps) {
    const [focused, setFocused] = useState(false);

    return (
        <TextInput
            {...props}
            style={[styles.input, focused && styles.inputFocused]}
            placeholderTextColor={COLORS.placeholder}
            onFocus={(event) => {
                setFocused(true);
                props.onFocus?.(event);
            }}
            onBlur={(event) => {
                setFocused(false);
                props.onBlur?.(event);
            }}
        />
    );
}

function ActionButton({
    title,
    loading,
    onPress,
}: {
    title: string;
    loading: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            style={[
                styles.saveButton,
                loading && styles.disabledButton,
            ]}
            onPress={onPress}
            disabled={loading}
            accessibilityRole="button"
        >
            {loading ? (
                <ActivityIndicator color={COLORS.white} />
            ) : (
                <Text style={styles.saveButtonText}>{title}</Text>
            )}
        </Pressable>
    );
}

function PageHeader({
    title,
    subtitle,
    onBack,
}: {
    title: string;
    subtitle: string;
    onBack: () => void;
}) {
    return (
        <View style={styles.header}>
            <Pressable
                style={styles.backButton}
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Back to profile"
            >
                <Icon name="back" size={22} color={COLORS.charcoal} />
            </Pressable>

            <View style={styles.headerTextWrap}>
                <Text style={styles.pageTitle}>{title}</Text>
                <Text style={styles.pageSubtitle} numberOfLines={1}>
                    {subtitle}
                </Text>
            </View>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function AccountSettingsScreen() {
    const router = useRouter();

    const [activeSection, setActiveSection] = useState<Section>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    /* ---------------------------- Logic (unchanged) ---------------------------- */

    const loadAccount = useCallback(async () => {
        try {
            setLoading(true);

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                Alert.alert(
                    'Session expired',
                    'Please sign in again to manage your account.'
                );
                router.replace('/(auth)/login');
                return;
            }

            setEmail(user.email ?? '');
            setNewEmail(user.email ?? '');

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            setFullName(profile?.full_name ?? '');
            setPhone(profile?.phone ?? '');
        } catch (error) {
            console.error('Account loading error:', error);
            Alert.alert(
                'Unable to load account',
                'Your account information could not be loaded. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        loadAccount();
    }, [loadAccount]);

    const toggleSection = (section: Exclude<Section, null>) => {
        setActiveSection((current) =>
            current === section ? null : section
        );
    };

    const savePersonalInformation = async () => {
        const trimmedName = fullName.trim();
        const trimmedPhone = phone.trim();

        if (!trimmedName) {
            Alert.alert('Name required', 'Please enter your full name.');
            return;
        }

        if (
            trimmedPhone &&
            !/^\+?[0-9\s()-]{7,20}$/.test(trimmedPhone)
        ) {
            Alert.alert(
                'Invalid phone number',
                'Please enter a valid contact number.'
            );
            return;
        }

        try {
            setSaving(true);

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;
            if (!user) throw new Error('Your session has expired.');

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: trimmedName,
                    phone: trimmedPhone || null,
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert(
                'Profile updated',
                'Your personal information has been saved.'
            );

            setActiveSection(null);
        } catch (error) {
            console.error('Personal information update error:', error);
            Alert.alert(
                'Update failed',
                error instanceof Error
                    ? error.message
                    : 'Could not update your personal information.'
            );
        } finally {
            setSaving(false);
        }
    };

    const changePassword = async () => {
        if (newPassword.length < 8) {
            Alert.alert(
                'Password too short',
                'Your new password must contain at least 8 characters.'
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert(
                'Passwords do not match',
                'Please make sure both password fields match.'
            );
            return;
        }

        try {
            setSaving(true);

            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            setNewPassword('');
            setConfirmPassword('');
            setActiveSection(null);

            Alert.alert(
                'Password updated',
                'Your account password has been changed successfully.'
            );
        } catch (error) {
            console.error('Password update error:', error);
            Alert.alert(
                'Password update failed',
                error instanceof Error
                    ? error.message
                    : 'Could not update your password.'
            );
        } finally {
            setSaving(false);
        }
    };

    const changeEmail = async () => {
        const trimmedEmail = newEmail.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            Alert.alert(
                'Invalid email',
                'Please enter a valid email address.'
            );
            return;
        }

        if (trimmedEmail === email.toLowerCase()) {
            Alert.alert(
                'No changes',
                'This is already your registered email address.'
            );
            return;
        }

        try {
            setSaving(true);

            const { error } = await supabase.auth.updateUser({
                email: trimmedEmail,
            });

            if (error) throw error;

            Alert.alert(
                'Email change requested',
                'Please check your email inbox and follow the confirmation instructions from Supabase before the new address becomes active.'
            );

            setActiveSection(null);
        } catch (error) {
            console.error('Email update error:', error);
            Alert.alert(
                'Email update failed',
                error instanceof Error
                    ? error.message
                    : 'Could not request an email address change.'
            );
        } finally {
            setSaving(false);
        }
    };

    /* -------------------------------- Render -------------------------------- */

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <PageHeader
                    title="Account Settings"
                    subtitle="Manage your account details"
                    onBack={() => router.back()}
                />

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.blue} />
                    <Text style={styles.loadingText}>
                        Loading your account...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <PageHeader
                title="Account Settings"
                subtitle="Manage your account details"
                onBack={() => router.back()}
            />

            <KeyboardAvoidingView
                style={styles.keyboard}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Signed-in account */}
                    <View style={styles.currentAccount}>
                        <View style={styles.currentIconCircle}>
                            <Icon name="mail" size={20} />
                        </View>

                        <View style={styles.currentTextWrap}>
                            <Text style={styles.currentLabel}>
                                Signed-in account
                            </Text>
                            <Text style={styles.currentEmail} numberOfLines={1}>
                                {email || 'No email available'}
                            </Text>
                        </View>
                    </View>

                    {/* Settings */}
                    <View style={styles.card}>
                        <SettingRow
                            icon="user"
                            title="Personal information"
                            description="Update your name and contact details."
                            active={activeSection === 'personal'}
                            onPress={() => toggleSection('personal')}
                        />

                        {activeSection === 'personal' && (
                            <View style={styles.form}>
                                <FormLabel>Full name</FormLabel>
                                <FormInput
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="Enter your full name"
                                    autoCapitalize="words"
                                />

                                <FormLabel>Phone number</FormLabel>
                                <FormInput
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="+254 7XX XXX XXX"
                                    keyboardType="phone-pad"
                                />

                                <ActionButton
                                    title="Save personal information"
                                    loading={saving}
                                    onPress={savePersonalInformation}
                                />
                            </View>
                        )}

                        <SettingRow
                            icon="lock"
                            title="Change password"
                            description="Update your account password."
                            active={activeSection === 'password'}
                            onPress={() => toggleSection('password')}
                        />

                        {activeSection === 'password' && (
                            <View style={styles.form}>
                                <FormLabel>New password</FormLabel>
                                <FormInput
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="Enter new password"
                                    secureTextEntry
                                    autoCapitalize="none"
                                />

                                <FormLabel>Confirm new password</FormLabel>
                                <FormInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm new password"
                                    secureTextEntry
                                    autoCapitalize="none"
                                />

                                <Text style={styles.helperText}>
                                    Use at least 8 characters.
                                </Text>

                                <ActionButton
                                    title="Update password"
                                    loading={saving}
                                    onPress={changePassword}
                                />
                            </View>
                        )}

                        <SettingRow
                            icon="mail"
                            title="Email address"
                            description="Manage your registered email."
                            active={activeSection === 'email'}
                            onPress={() => toggleSection('email')}
                        />

                        {activeSection === 'email' && (
                            <View style={styles.form}>
                                <FormLabel>New email address</FormLabel>
                                <FormInput
                                    value={newEmail}
                                    onChangeText={setNewEmail}
                                    placeholder="Enter new email address"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />

                                <Text style={styles.helperText}>
                                    Supabase may send a confirmation link before
                                    changing your registered email.
                                </Text>

                                <ActionButton
                                    title="Request email change"
                                    loading={saving}
                                    onPress={changeEmail}
                                />
                            </View>
                        )}

                        <SettingRow
                            icon="phone"
                            title="Phone number"
                            description="Manage your contact number."
                            active={activeSection === 'personal'}
                            onPress={() => setActiveSection('personal')}
                            last
                        />
                    </View>

                    <Text style={styles.footer}>
                        Keep your account information accurate so your school
                        can contact you when necessary.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    keyboard: {
        flex: 1,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    backButton: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
    },

    headerTextWrap: {
        flex: 1,
    },

    pageTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 24,
    },

    pageSubtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.serif,
        fontSize: 14,
        marginTop: 2,
    },

    scrollView: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },

    /* Loading */
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },

    loadingText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
    },

    /* Signed-in account */
    currentAccount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: COLORS.paleBlue,
        borderRadius: 18,
        padding: 16,
    },

    currentIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },

    currentTextWrap: {
        flex: 1,
    },

    currentLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12.5,
    },

    currentEmail: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
        marginTop: 1,
    },

    /* Settings card */
    card: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        paddingHorizontal: 16,
        marginTop: 20,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 72,
        paddingVertical: 12,
    },

    divider: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    rowIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    rowTextWrap: {
        flex: 1,
    },

    rowTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
    },

    rowDescription: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        marginTop: 1,
    },

    /* Forms */
    form: {
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    formLabel: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
        marginTop: 12,
        marginBottom: 8,
    },

    input: {
        minHeight: 50,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 15.5,
    },

    inputFocused: {
        borderColor: COLORS.blue,
    },

    helperText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 10,
    },

    saveButton: {
        minHeight: 50,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
    },

    disabledButton: {
        opacity: 0.65,
    },

    saveButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
    },

    footer: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 24,
    },
});