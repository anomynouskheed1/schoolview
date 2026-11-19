import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/lib/supabase';

/* -------------------------------------------------------------------------- */
/*  Design tokens (same as the other screens)                                 */
/* -------------------------------------------------------------------------- */

const COLORS = {
    blue: '#1683C5',
    charcoal: '#292D32',
    paleBlue: '#E8F5FC',
    white: '#FFFFFF',
    muted: '#6B7280',
    border: '#E4E8EC',
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

type AnnouncementDetails = {
    id: string;
    school_id: string;
    class_id: string | null;
    title: string;
    body: string;
    category: string;
    priority: string;
    published_at: string | null;
};

function BackIcon() {
    return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
                d="M15 18l-6-6 6-6"
                fill="none"
                stroke={COLORS.charcoal}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

export default function AnnouncementDetailsScreen() {
    const router = useRouter();

    const { announcementId } =
        useLocalSearchParams<{ announcementId: string }>();

    const [announcement, setAnnouncement] =
        useState<AnnouncementDetails | null>(null);
    const [schoolName, setSchoolName] = useState('');
    const [className, setClassName] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    /* -------- Data: same table and columns the announcements list uses -------- */

    const loadAnnouncement = useCallback(async () => {
        if (!announcementId) {
            setError('This announcement could not be found.');
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setError('');

            // RLS decides whether this parent may read the announcement.
            const { data, error: announcementError } = await supabase
                .from('announcements')
                .select(`
                    id,
                    school_id,
                    class_id,
                    title,
                    body,
                    category,
                    priority,
                    published_at
                `)
                .eq('id', announcementId)
                .maybeSingle();

            if (announcementError) throw announcementError;

            if (!data) {
                setAnnouncement(null);
                setError('This announcement is no longer available.');
                return;
            }

            const row = data as AnnouncementDetails;
            setAnnouncement(row);

            const [schoolResult, classResult] = await Promise.all([
                supabase
                    .from('schools')
                    .select('name')
                    .eq('id', row.school_id)
                    .maybeSingle(),

                row.class_id
                    ? supabase
                        .from('classes')
                        .select('name')
                        .eq('id', row.class_id)
                        .maybeSingle()
                    : Promise.resolve({ data: null, error: null }),
            ]);

            setSchoolName(schoolResult.data?.name ?? '');
            setClassName(classResult.data?.name ?? '');
        } catch (err) {
            console.error('Announcement details error:', err);
            setError('We could not load this announcement. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [announcementId]);

    useEffect(() => {
        loadAnnouncement();
    }, [loadAnnouncement]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAnnouncement();
    };

    /* ------------------------------ Display helpers ----------------------------- */

    const formatDate = (date: string | null) => {
        if (!date) return 'Recently published';

        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return 'Recently published';

        return parsed.toLocaleString('en-KE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const getLabel = (item: AnnouncementDetails) => {
        if (item.priority === 'urgent') return 'Urgent';
        if (item.priority === 'important') return 'Important';

        const labels: Record<string, string> = {
            general: 'General',
            academic: 'Academic',
            event: 'Event',
            reminder: 'Reminder',
        };

        return labels[item.category] || item.category.replace(/_/g, ' ');
    };

    const getBadge = (item: AnnouncementDetails) => {
        if (item.priority === 'urgent') {
            return { bg: COLORS.redSoft, color: COLORS.red };
        }
        if (item.priority === 'important') {
            return { bg: COLORS.blue, color: COLORS.white };
        }
        if (item.category === 'reminder') {
            return { bg: COLORS.greySoft, color: COLORS.charcoal };
        }
        return { bg: COLORS.paleBlue, color: COLORS.blue };
    };

    /* -------------------------------- Render -------------------------------- */

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Back to announcements"
                >
                    <BackIcon />
                </Pressable>

                <Text style={styles.headerTitle}>Announcement</Text>

                {/* Spacer keeps the title centred */}
                <View style={styles.backButtonSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.blue}
                    />
                }
            >
                {loading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator color={COLORS.blue} size="large" />
                        <Text style={styles.stateText}>
                            Loading announcement...
                        </Text>
                    </View>
                ) : error || !announcement ? (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            Unable to show announcement
                        </Text>
                        <Text style={styles.stateText}>
                            {error || 'This announcement is not available.'}
                        </Text>

                        <Pressable
                            style={styles.primaryButton}
                            onPress={loadAnnouncement}
                        >
                            <Text style={styles.primaryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {/* Title block */}
                        <View
                            style={[
                                styles.badge,
                                { backgroundColor: getBadge(announcement).bg },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.badgeText,
                                    { color: getBadge(announcement).color },
                                ]}
                            >
                                {getLabel(announcement)}
                            </Text>
                        </View>

                        <Text style={styles.title}>{announcement.title}</Text>

                        <Text style={styles.published}>
                            {formatDate(announcement.published_at)}
                        </Text>

                        {/* Message */}
                        <View style={styles.card}>
                            <Text style={styles.bodyText}>
                                {announcement.body}
                            </Text>
                        </View>

                        {/* Details */}
                        <View style={styles.card}>
                            <Text style={styles.cardHeading}>Details</Text>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>
                                    Published by
                                </Text>
                                <Text style={styles.detailValue}>
                                    {schoolName || 'Your school'}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>
                                    Audience
                                </Text>
                                <Text style={styles.detailValue}>
                                    {className
                                        ? className
                                        : 'Whole school'}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>
                                    Category
                                </Text>
                                <Text
                                    style={[
                                        styles.detailValue,
                                        styles.capitalise,
                                    ]}
                                >
                                    {announcement.category.replace(/_/g, ' ')}
                                </Text>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
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

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
    },

    backButtonSpacer: {
        width: 46,
    },

    headerTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    scrollView: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    container: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },

    badge: {
        alignSelf: 'flex-start',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: 14,
    },

    badgeText: {
        fontFamily: FONTS.bodyBold,
        fontSize: 12.5,
        textTransform: 'capitalize',
    },

    title: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 26,
        lineHeight: 33,
    },

    published: {
        color: COLORS.muted,
        fontFamily: FONTS.serif,
        fontSize: 14,
        marginTop: 8,
        marginBottom: 22,
    },

    card: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
    },

    bodyText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 16,
        lineHeight: 25,
    },

    cardHeading: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 18,
        marginBottom: 12,
    },

    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        paddingVertical: 4,
    },

    detailLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 14,
    },

    detailValue: {
        flex: 1,
        textAlign: 'right',
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
    },

    capitalise: {
        textTransform: 'capitalize',
    },

    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 10,
    },

    stateCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 28,
        alignItems: 'center',
    },

    stateTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 18,
        textAlign: 'center',
    },

    stateText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 8,
    },

    primaryButton: {
        minHeight: 48,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        paddingHorizontal: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
    },

    primaryButtonText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
    },
});