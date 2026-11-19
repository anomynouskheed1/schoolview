import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polygon } from 'react-native-svg';
import { supabase } from '@/lib/supabase';

/* -------------------------------------------------------------------------- */
/*  Design tokens (same as Home - move to a shared theme file later)          */
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

/* -------------------------------------------------------------------------- */
/*  Types (unchanged)                                                         */
/* -------------------------------------------------------------------------- */

type Announcement = {
    id: string;
    school_id: string;
    class_id: string | null;
    title: string;
    body: string;
    category: string;
    priority: string;
    published_at: string | null;
};

type FilterType = 'all' | 'unread' | 'important';

type School = {
    id: string;
    name: string;
};

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

function Icon({
    name,
    size = 24,
    color = COLORS.blue,
}: {
    name: 'bell' | 'announce' | 'chevron';
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
            {name === 'bell' && (
                <>
                    <Path
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                        {...common}
                    />
                    <Path d="M10 21h4" {...common} />
                </>
            )}
            {name === 'announce' && (
                <>
                    <Polygon
                        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                        {...common}
                    />
                    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" {...common} />
                    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" {...common} />
                </>
            )}
            {name === 'chevron' && <Path d="M9 18l6-6-6-6" {...common} />}
        </Svg>
    );
}

function StatCell({
    value,
    label,
    highlight,
}: {
    value: number;
    label: string;
    highlight?: 'blue' | 'red';
}) {
    return (
        <View style={styles.statCell}>
            <Text
                style={[
                    styles.statValue,
                    highlight === 'blue' && { color: COLORS.blue },
                    highlight === 'red' && { color: COLORS.red },
                ]}
            >
                {value}
            </Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function AnnouncementsScreen() {
    const router = useRouter();

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [readIds, setReadIds] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    const [parentName, setParentName] = useState('Parent');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [schoolNames, setSchoolNames] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [avatarFailed, setAvatarFailed] = useState(false);

    /* ---------------------------- Data (unchanged) ---------------------------- */

    const loadAnnouncements = useCallback(async () => {
        try {
            setError('');

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) throw userError;

            if (!user) {
                setAnnouncements([]);
                setReadIds([]);
                setError('Please sign in again to view your announcements.');
                return;
            }

            // Load parent profile.
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            setParentName(
                profile?.full_name ||
                user.user_metadata?.full_name ||
                user.email?.split('@')[0] ||
                'Parent'
            );

            setAvatarUrl(profile?.avatar_url ?? null);
            setAvatarFailed(false);

            // Get schools connected to approved parent-child relationships.
            const { data: relationships, error: relationshipError } =
                await supabase
                    .from('parent_students')
                    .select('school_id')
                    .eq('parent_id', user.id)
                    .eq('status', 'approved');

            if (relationshipError) throw relationshipError;

            const schoolIds = [
                ...new Set(
                    (relationships ?? []).map((item) => item.school_id)
                ),
            ];

            if (schoolIds.length === 0) {
                setAnnouncements([]);
                setReadIds([]);
                setSchoolNames([]);
                return;
            }

            const { data: schools, error: schoolsError } = await supabase
                .from('schools')
                .select('id, name')
                .in('id', schoolIds);

            if (schoolsError) throw schoolsError;

            setSchoolNames(
                (schools ?? []).map((school: School) => school.name)
            );

            // RLS determines which school and class announcements
            // this parent is allowed to read.
            const { data: announcementData, error: announcementError } =
                await supabase
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
                    .in('school_id', schoolIds)
                    .not('published_at', 'is', null)
                    .order('published_at', { ascending: false });

            if (announcementError) throw announcementError;

            const rows = (announcementData ?? []) as Announcement[];

            setAnnouncements(rows);

            if (rows.length === 0) {
                setReadIds([]);
                return;
            }

            // Load announcements already opened by this parent.
            const announcementIds = rows.map((item) => item.id);

            const { data: readData, error: readError } = await supabase
                .from('announcement_reads')
                .select('announcement_id')
                .eq('parent_id', user.id)
                .in('announcement_id', announcementIds);

            if (readError) throw readError;

            setReadIds(
                (readData ?? []).map((item) => item.announcement_id)
            );
        } catch (err) {
            console.error('Announcements screen error:', err);
            setError('We could not load your announcements. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAnnouncements();
    }, [loadAnnouncements]);

    const onRefresh = () => {
        setRefreshing(true);
        loadAnnouncements();
    };

    const unreadCount = announcements.filter(
        (item) => !readIds.includes(item.id)
    ).length;

    const importantCount = announcements.filter(
        (item) =>
            item.priority === 'important' ||
            item.priority === 'urgent'
    ).length;

    const filteredAnnouncements = useMemo(() => {
        if (activeFilter === 'unread') {
            return announcements.filter(
                (item) => !readIds.includes(item.id)
            );
        }

        if (activeFilter === 'important') {
            return announcements.filter(
                (item) =>
                    item.priority === 'important' ||
                    item.priority === 'urgent'
            );
        }

        return announcements;
    }, [announcements, readIds, activeFilter]);

    const openAnnouncement = async (announcement: Announcement) => {
        if (openingId) return;

        setOpeningId(announcement.id);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user && !readIds.includes(announcement.id)) {
                const { error: markReadError } = await supabase
                    .from('announcement_reads')
                    .upsert(
                        {
                            announcement_id: announcement.id,
                            parent_id: user.id,
                        },
                        {
                            onConflict: 'announcement_id,parent_id',
                            ignoreDuplicates: true,
                        }
                    );

                if (markReadError) {
                    console.error(
                        'Could not mark announcement as read:',
                        markReadError
                    );
                } else {
                    setReadIds((current) =>
                        current.includes(announcement.id)
                            ? current
                            : [...current, announcement.id]
                    );
                }
            }

            router.push({
                pathname: '/(parent)/announcements/[announcementId]',
                params: { announcementId: announcement.id },
            });
        } catch (err) {
            console.error('Could not open announcement:', err);
        } finally {
            setOpeningId(null);
        }
    };

    const formatDate = (date: string | null) => {
        if (!date) return 'Recently published';

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return 'Recently published';
        }

        return parsedDate.toLocaleString('en-KE', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const getCategoryLabel = (announcement: Announcement) => {
        if (announcement.priority === 'urgent') return 'Urgent';
        if (announcement.priority === 'important') return 'Important';

        const labels: Record<string, string> = {
            general: 'General',
            academic: 'Academic',
            event: 'Event',
            reminder: 'Reminder',
            urgent: 'Urgent',
        };

        return labels[announcement.category] ||
            announcement.category.replace(/_/g, ' ');
    };

    // Red is reserved for urgent notices. Important is solid blue.
    // Everything else stays in the calm blue / grey family.
    const getBadgeStyle = (announcement: Announcement) => {
        if (announcement.priority === 'urgent') {
            return {
                container: styles.badgeUrgent,
                text: { color: COLORS.red },
            };
        }

        if (announcement.priority === 'important') {
            return {
                container: styles.badgeImportant,
                text: { color: COLORS.white },
            };
        }

        if (announcement.category === 'reminder') {
            return {
                container: styles.badgeNeutral,
                text: { color: COLORS.charcoal },
            };
        }

        return {
            container: styles.badgeBlue,
            text: { color: COLORS.blue },
        };
    };

    const schoolDescription = schoolNames.length > 0
        ? `Stay connected for the latest updates from ${schoolNames.join(', ')}.`
        : 'Stay connected for the latest updates from your school.';

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'unread', label: `Unread (${unreadCount})` },
        { key: 'important', label: 'Important' },
    ] as const;

    /* -------------------------------- Render -------------------------------- */

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Page header */}
            <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.pageTitle}>Announcements</Text>
                    <Text style={styles.pageSubtitle} numberOfLines={1}>
                        Updates from your child's school
                    </Text>
                </View>

                <View style={styles.headerActions}>
                    <Pressable
                        style={styles.iconButton}
                        onPress={() =>
                            router.push('/(parent)/profile/notifications')
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Open notifications"
                    >
                        <Icon name="bell" size={24} />

                        {unreadCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </Pressable>

                    <Pressable
                        style={styles.avatarButton}
                        onPress={() => router.push('/(parent)/profile')}
                        accessibilityRole="button"
                        accessibilityLabel="Open profile"
                    >
                        {avatarUrl && !avatarFailed ? (
                            <Image
                                source={{ uri: avatarUrl }}
                                style={styles.avatarImage}
                                onError={() => setAvatarFailed(true)}
                            />
                        ) : (
                            <Text style={styles.avatarInitial}>
                                {parentName.trim().charAt(0).toUpperCase() || 'P'}
                            </Text>
                        )}
                    </Pressable>
                </View>
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
                {/* Summary */}
                <View style={styles.summaryCard}>
                    <StatCell value={announcements.length} label="Total" />
                    <View style={styles.statDivider} />
                    <StatCell
                        value={unreadCount}
                        label="Unread"
                        highlight={unreadCount > 0 ? 'blue' : undefined}
                    />
                    <View style={styles.statDivider} />
                    <StatCell value={importantCount} label="Important" />
                </View>

                {/* Filters */}
                <View style={styles.filterRow}>
                    {filters.map((filter) => {
                        const active = activeFilter === filter.key;

                        return (
                            <Pressable
                                key={filter.key}
                                style={[
                                    styles.filterButton,
                                    active && styles.filterButtonActive,
                                ]}
                                onPress={() => setActiveFilter(filter.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                            >
                                <Text
                                    style={[
                                        styles.filterText,
                                        active && styles.filterTextActive,
                                    ]}
                                >
                                    {filter.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Loading, error and empty states */}
                {loading ? (
                    <View style={styles.stateCard}>
                        <ActivityIndicator color={COLORS.blue} size="large" />
                        <Text style={styles.stateText}>
                            Loading your school announcements...
                        </Text>
                    </View>
                ) : error ? (
                    <View style={styles.stateCard}>
                        <Text style={styles.stateTitle}>
                            Unable to load announcements
                        </Text>
                        <Text style={styles.stateText}>{error}</Text>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={loadAnnouncements}
                        >
                            <Text style={styles.primaryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : filteredAnnouncements.length === 0 ? (
                    <View style={styles.stateCard}>
                        <View style={styles.stateIconCircle}>
                            <Icon name="announce" size={26} />
                        </View>
                        <Text style={styles.stateTitle}>
                            {activeFilter === 'unread'
                                ? 'You are all caught up'
                                : activeFilter === 'important'
                                    ? 'No important announcements'
                                    : 'No announcements yet'}
                        </Text>

                        <Text style={styles.stateText}>
                            {activeFilter === 'unread'
                                ? 'You have opened all available school announcements.'
                                : activeFilter === 'important'
                                    ? 'Important school updates will appear here when published.'
                                    : 'When your school publishes announcements, they will appear here.'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.announcementsList}>
                        {filteredAnnouncements.map((announcement) => {
                            const isUnread = !readIds.includes(announcement.id);
                            const badge = getBadgeStyle(announcement);

                            return (
                                <Pressable
                                    key={announcement.id}
                                    style={[
                                        styles.announcementCard,
                                        isUnread && styles.announcementCardUnread,
                                    ]}
                                    onPress={() => openAnnouncement(announcement)}
                                    disabled={openingId !== null}
                                >
                                    <View style={styles.cardTopRow}>
                                        <View style={[styles.badge, badge.container]}>
                                            <Text
                                                style={[styles.badgeText, badge.text]}
                                            >
                                                {getCategoryLabel(announcement)}
                                            </Text>
                                        </View>

                                        <Text style={styles.dateText}>
                                            {formatDate(announcement.published_at)}
                                        </Text>
                                    </View>

                                    <Text
                                        style={styles.announcementTitle}
                                        numberOfLines={2}
                                    >
                                        {announcement.title}
                                    </Text>

                                    <Text
                                        style={styles.announcementBody}
                                        numberOfLines={3}
                                    >
                                        {announcement.body}
                                    </Text>

                                    <View style={styles.cardBottomRow}>
                                        {isUnread ? (
                                            <View style={styles.unreadLabel}>
                                                <View style={styles.unreadDot} />
                                                <Text style={styles.unreadText}>
                                                    Unread
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text style={styles.readText}>Read</Text>
                                        )}

                                        {openingId === announcement.id ? (
                                            <ActivityIndicator
                                                color={COLORS.blue}
                                                size="small"
                                            />
                                        ) : (
                                            <Icon
                                                name="chevron"
                                                size={20}
                                                color={COLORS.charcoal}
                                            />
                                        )}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {/* School information */}
                <View style={styles.schoolInfoCard}>
                    <Text style={styles.schoolInfoText}>
                        {schoolDescription}
                    </Text>
                </View>

                <Text style={styles.footer}>
                    SchoolView · School updates in one place
                </Text>
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

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    headerTextWrap: {
        flex: 1,
        marginRight: 12,
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

    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    iconButton: {
        width: 46,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
    },

    notificationBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.red,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        borderWidth: 2,
        borderColor: COLORS.white,
    },

    notificationBadgeText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 10,
    },

    avatarButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    avatarImage: {
        width: '100%',
        height: '100%',
    },

    avatarInitial: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    /* Scroll area */
    scrollView: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    container: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },

    /* Summary */
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        paddingVertical: 16,
        marginBottom: 20,
    },

    statCell: {
        flex: 1,
        alignItems: 'center',
    },

    statValue: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 24,
    },

    statLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12.5,
        marginTop: 1,
    },

    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: COLORS.border,
    },

    /* Filters */
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 18,
    },

    filterButton: {
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    filterButtonActive: {
        backgroundColor: COLORS.blue,
        borderColor: COLORS.blue,
    },

    filterText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 13.5,
    },

    filterTextActive: {
        color: COLORS.white,
    },

    /* Announcement cards */
    announcementsList: {
        gap: 12,
    },

    announcementCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    announcementCardUnread: {
        borderColor: COLORS.blue,
    },

    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },

    badge: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },

    badgeBlue: { backgroundColor: COLORS.paleBlue },
    badgeImportant: { backgroundColor: COLORS.blue },
    badgeUrgent: { backgroundColor: COLORS.redSoft },
    badgeNeutral: { backgroundColor: COLORS.greySoft },

    badgeText: {
        fontFamily: FONTS.bodyBold,
        fontSize: 12,
        textTransform: 'capitalize',
    },

    dateText: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12,
        flexShrink: 1,
    },

    announcementTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 16.5,
        lineHeight: 22,
    },

    announcementBody: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 5,
    },

    cardBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        minHeight: 22,
    },

    unreadLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.blue,
    },

    unreadText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 12.5,
    },

    readText: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12.5,
    },

    /* States */
    stateCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 28,
        alignItems: 'center',
    },

    stateIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
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

    /* School info + footer */
    schoolInfoCard: {
        backgroundColor: COLORS.paleBlue,
        borderRadius: 18,
        padding: 18,
        marginTop: 24,
    },

    schoolInfoText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
    },

    footer: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 28,
    },
});