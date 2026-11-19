import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Switch,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

type Preferences = {
    school_updates: boolean;
    announcements: boolean;
    approval_updates: boolean;
    live_alerts: boolean;
};

type PreferenceKey = keyof Preferences;

const DEFAULT_PREFERENCES: Preferences = {
    school_updates: true,
    announcements: true,
    approval_updates: true,
    live_alerts: true,
};

type IconName = 'back' | 'school' | 'megaphone' | 'check' | 'video' | 'info';

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
        stroke: color,
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        fill: 'none',
    };

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            {name === 'back' && <Path d="M15 18l-6-6 6-6" {...common} />}
            {name === 'school' && (
                <>
                    <Path d="M3 10l9-6 9 6" {...common} />
                    <Path d="M5 10v9h14v-9" {...common} />
                    <Path d="M10 19v-5h4v5" {...common} />
                </>
            )}
            {name === 'megaphone' && (
                <>
                    <Path
                        d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"
                        {...common}
                    />
                    <Path d="M15.5 9a4 4 0 0 1 0 6" {...common} />
                </>
            )}
            {name === 'check' && (
                <>
                    <Circle cx={12} cy={12} r={9} {...common} />
                    <Path d="M8 12.5l3 3 5-6" {...common} />
                </>
            )}
            {name === 'video' && (
                <>
                    <Rect x={2} y={6} width={14} height={12} rx={2} {...common} />
                    <Path d="M16 10l6-3v10l-6-3" {...common} />
                </>
            )}
            {name === 'info' && (
                <>
                    <Circle cx={12} cy={12} r={9} {...common} />
                    <Path d="M12 11v5" {...common} />
                    <Path d="M12 8h.01" {...common} />
                </>
            )}
        </Svg>
    );
}

export default function NotificationSettingsScreen() {
    const router = useRouter();

    const [preferences, setPreferences] =
        useState<Preferences>(DEFAULT_PREFERENCES);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const loadPreferences = useCallback(async () => {
        try {
            setError('');

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Please sign in again to manage your preferences.');
            }

            const { data, error: fetchError } = await supabase
                .from('notification_preferences')
                .select(`
                    school_updates,
                    announcements,
                    approval_updates,
                    live_alerts
                `)
                .eq('user_id', user.id)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (data) {
                setPreferences({
                    school_updates: data.school_updates,
                    announcements: data.announcements,
                    approval_updates: data.approval_updates,
                    live_alerts: data.live_alerts,
                });
            } else {
                // Create the parent's preferences with database defaults.
                const { data: newPreferences, error: insertError } =
                    await supabase
                        .from('notification_preferences')
                        .insert({ user_id: user.id })
                        .select(`
                            school_updates,
                            announcements,
                            approval_updates,
                            live_alerts
                        `)
                        .single();

                if (insertError) throw insertError;

                setPreferences({
                    school_updates: newPreferences.school_updates,
                    announcements: newPreferences.announcements,
                    approval_updates: newPreferences.approval_updates,
                    live_alerts: newPreferences.live_alerts,
                });
            }
        } catch (err) {
            console.error('Notification preferences error:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not load notification preferences.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPreferences();
        setRefreshing(false);
    };

    const updatePreference = async (
        key: PreferenceKey,
        value: boolean
    ) => {
        if (saving) return;

        const previousValue = preferences[key];

        setPreferences((current) => ({
            ...current,
            [key]: value,
        }));

        setSaving(true);
        setError('');

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Your session has expired. Please sign in again.');
            }

            const { error: updateError } = await supabase
                .from('notification_preferences')
                .update({
                    [key]: value,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);

            if (updateError) throw updateError;
        } catch (err) {
            console.error('Could not save notification preference:', err);

            setPreferences((current) => ({
                ...current,
                [key]: previousValue,
            }));

            Alert.alert(
                'Could not save',
                'Your notification preference was not saved. Please try again.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={4}
                >
                    <Icon name="back" size={22} color={COLORS.charcoal} />
                </Pressable>

                <View style={styles.headerText}>
                    <Text style={styles.title}>Notifications</Text>
                    <Text style={styles.subtitle}>
                        Choose the updates you want to receive.
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.blue}
                        colors={[COLORS.blue]}
                    />
                }
            >
                {loading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator color={COLORS.blue} size="large" />
                        <Text style={styles.stateText}>
                            Loading your preferences...
                        </Text>
                    </View>
                ) : error ? (
                    <View style={[styles.stateCard, styles.errorCard]}>
                        <Text style={styles.errorText}>{error}</Text>
                        <Pressable
                            style={styles.retryButton}
                            onPress={loadPreferences}
                            accessibilityRole="button"
                            accessibilityLabel="Try loading preferences again"
                        >
                            <Text style={styles.retryText}>Try again</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>Alert preferences</Text>

                        <View style={styles.card}>
                            <NotificationRow
                                icon="school"
                                title="School updates"
                                description="General updates from your school."
                                value={preferences.school_updates}
                                disabled={saving}
                                onChange={(value) =>
                                    updatePreference('school_updates', value)
                                }
                            />

                            <NotificationRow
                                icon="megaphone"
                                title="Announcements"
                                description="New school announcements."
                                value={preferences.announcements}
                                disabled={saving}
                                onChange={(value) =>
                                    updatePreference('announcements', value)
                                }
                            />

                            <NotificationRow
                                icon="check"
                                title="Approval updates"
                                description="Changes to your registration status."
                                value={preferences.approval_updates}
                                disabled={saving}
                                onChange={(value) =>
                                    updatePreference('approval_updates', value)
                                }
                            />

                            <NotificationRow
                                icon="video"
                                title="Live monitoring alerts"
                                description="Relevant classroom camera availability updates."
                                value={preferences.live_alerts}
                                disabled={saving}
                                onChange={(value) =>
                                    updatePreference('live_alerts', value)
                                }
                                last
                            />
                        </View>

                        <View style={styles.noteBox}>
                            <View style={styles.noteIcon}>
                                <Icon name="info" size={18} />
                            </View>
                            <Text style={styles.noteText}>
                                Your preferences are saved automatically to your
                                account. You can change them whenever you like.
                            </Text>
                        </View>

                        {saving && (
                            <View
                                style={styles.savingRow}
                                accessibilityLiveRegion="polite"
                            >
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.blue}
                                />
                                <Text style={styles.savingText}>
                                    Saving changes...
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function NotificationRow({
    icon,
    title,
    description,
    value,
    onChange,
    disabled = false,
    last = false,
}: {
    icon: IconName;
    title: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    last?: boolean;
}) {
    return (
        <View style={[styles.row, !last && styles.divider]}>
            <View style={styles.iconCircle}>
                <Icon name={icon} size={20} />
            </View>

            <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowDescription}>{description}</Text>
            </View>

            <Switch
                value={value}
                onValueChange={onChange}
                disabled={disabled}
                accessibilityRole="switch"
                accessibilityLabel={title}
                accessibilityState={{ checked: value, disabled }}
                trackColor={{
                    false: COLORS.border,
                    true: COLORS.blue,
                }}
                thumbColor={COLORS.white}
                ios_backgroundColor={COLORS.border}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    backButton: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: COLORS.charcoal,
        fontSize: 24,
        fontFamily: FONTS.heading,
    },
    subtitle: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.serif,
        marginTop: 2,
    },
    content: {
        padding: 20,
        paddingBottom: 35,
    },
    sectionTitle: {
        color: COLORS.charcoal,
        fontSize: 20,
        fontFamily: FONTS.heading,
        marginBottom: 12,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        minHeight: 72,
    },
    divider: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rowText: {
        flex: 1,
        paddingRight: 12,
    },
    rowTitle: {
        color: COLORS.charcoal,
        fontSize: 15,
        fontFamily: FONTS.bodyBold,
    },
    rowDescription: {
        color: COLORS.muted,
        fontSize: 12.5,
        lineHeight: 18,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.paleBlue,
        borderRadius: 14,
        padding: 14,
        marginTop: 18,
    },
    noteIcon: {
        marginRight: 10,
        marginTop: 1,
    },
    noteText: {
        flex: 1,
        color: COLORS.charcoal,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.body,
    },
    stateCard: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 28,
        alignItems: 'center',
    },
    stateText: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.bodyMedium,
        marginTop: 12,
    },
    errorCard: {
        backgroundColor: COLORS.redSoft,
        borderColor: COLORS.redSoft,
    },
    errorText: {
        color: COLORS.red,
        fontSize: 14,
        fontFamily: FONTS.bodyMedium,
        textAlign: 'center',
        lineHeight: 20,
    },
    retryButton: {
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        minHeight: 48,
        paddingHorizontal: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    retryText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
    },
    savingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 8,
    },
    savingText: {
        color: COLORS.muted,
        fontSize: 13,
        fontFamily: FONTS.bodyMedium,
    },
});