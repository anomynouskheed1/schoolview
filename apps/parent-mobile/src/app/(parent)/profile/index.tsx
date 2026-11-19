import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Alert,
    Image,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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

// Route of the "My School" screen. Change this one line if your file is
// named differently (for example '/(parent)/profile/schools').
const SCHOOL_ROUTE = '/(parent)/profile/school' as const;

type ChildItem = {
    id: string;
    full_name: string;
    admission_number: string;
    class_name: string;
    school_name: string;
    status: string;
};

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

type IconName =
    | 'bell'
    | 'user'
    | 'mail'
    | 'phone'
    | 'school'
    | 'shield'
    | 'help'
    | 'info'
    | 'chevron'
    | 'logout';

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
            {name === 'bell' && (
                <>
                    <Path
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                        {...common}
                    />
                    <Path d="M10 21h4" {...common} />
                </>
            )}
            {name === 'user' && (
                <>
                    <Path
                        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                        {...common}
                    />
                    <Circle cx={12} cy={7} r={4} {...common} />
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
            {name === 'school' && (
                <>
                    <Path d="M3 21h18" {...common} />
                    <Path d="M5 21V7l7-4 7 4v14" {...common} />
                    <Path d="M9 21v-6h6v6" {...common} />
                </>
            )}
            {name === 'shield' && (
                <>
                    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...common} />
                    <Path d="M9 12l2 2 4-4" {...common} />
                </>
            )}
            {name === 'help' && (
                <>
                    <Circle cx={12} cy={12} r={10} {...common} />
                    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" {...common} />
                    <Path d="M12 17h.01" {...common} />
                </>
            )}
            {name === 'info' && (
                <>
                    <Circle cx={12} cy={12} r={10} {...common} />
                    <Path d="M12 16v-4M12 8h.01" {...common} />
                </>
            )}
            {name === 'chevron' && <Path d="M9 18l6-6-6-6" {...common} />}
            {name === 'logout' && (
                <>
                    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...common} />
                    <Path d="M16 17l5-5-5-5M21 12H9" {...common} />
                </>
            )}
        </Svg>
    );
}

function SectionHeader({
    title,
    actionLabel,
    onActionPress,
}: {
    title: string;
    actionLabel?: string;
    onActionPress?: () => void;
}) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>

            {actionLabel && onActionPress ? (
                <Pressable
                    onPress={onActionPress}
                    hitSlop={10}
                    style={styles.sectionAction}
                >
                    <Text style={styles.sectionActionText}>{actionLabel}</Text>
                    <Icon name="chevron" size={18} />
                </Pressable>
            ) : null}
        </View>
    );
}

function InfoRow({
    icon,
    label,
    value,
    last = false,
    onPress,
}: {
    icon: IconName;
    label: string;
    value: string;
    last?: boolean;
    onPress?: () => void;
}) {
    const content = (
        <>
            <View style={styles.rowIconCircle}>
                <Icon name={icon} size={18} />
            </View>
            <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                    {value}
                </Text>
            </View>
            {onPress ? (
                <Icon name="chevron" size={20} color={COLORS.charcoal} />
            ) : null}
        </>
    );

    // Rows with an onPress open another screen; plain rows are display only.
    if (onPress) {
        return (
            <Pressable
                style={[styles.infoRow, !last && styles.rowBorder]}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${value}`}
            >
                {content}
            </Pressable>
        );
    }

    return (
        <View style={[styles.infoRow, !last && styles.rowBorder]}>
            {content}
        </View>
    );
}

function ProfileRow({
    icon,
    title,
    description,
    onPress,
    badge,
    last = false,
}: {
    icon: IconName;
    title: string;
    description: string;
    onPress: () => void;
    badge?: number;
    last?: boolean;
}) {
    return (
        <Pressable
            style={[styles.settingRow, !last && styles.rowBorder]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={title}
        >
            <View style={styles.rowIconCircle}>
                <Icon name={icon} size={18} />
            </View>

            <View style={styles.rowTextWrap}>
                <Text style={styles.settingTitle}>{title}</Text>
                <Text style={styles.settingDescription} numberOfLines={1}>
                    {description}
                </Text>
            </View>

            {badge ? (
                <View style={styles.rowBadge}>
                    <Text style={styles.rowBadgeText}>
                        {badge > 9 ? '9+' : badge}
                    </Text>
                </View>
            ) : null}

            <Icon name="chevron" size={20} color={COLORS.charcoal} />
        </Pressable>
    );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function ProfileScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [parentName, setParentName] = useState('Parent');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [children, setChildren] = useState<ChildItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadError, setLoadError] = useState('');

    /* ---------------------------- Data (unchanged) ---------------------------- */

    const loadProfile = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        setLoadError('');

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                router.replace('/(auth)/login');
                return;
            }

            setEmail(user.email ?? '');

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('full_name, phone, avatar_url')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) throw profileError;

            setParentName(profile?.full_name || 'Parent account');
            setPhone(profile?.phone || '');
            setAvatarUrl(profile?.avatar_url || null);
            setAvatarFailed(false);

            // Get real unread notification count.
            const { count, error: notificationError } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (!notificationError) {
                setUnreadCount(count ?? 0);
            }

            // Load parent-child relationships.
            const { data: relationships, error: relationshipError } =
                await supabase
                    .from('parent_students')
                    .select('id, student_id, school_id, status')
                    .eq('parent_id', user.id)
                    .in('status', ['approved', 'pending']);

            if (relationshipError) throw relationshipError;

            if (!relationships?.length) {
                setChildren([]);
                return;
            }

            const studentIds = [
                ...new Set(relationships.map((item) => item.student_id)),
            ];

            const schoolIds = [
                ...new Set(relationships.map((item) => item.school_id)),
            ];

            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('id, full_name, admission_number, class_id, school_id')
                .in('id', studentIds);

            if (studentsError) throw studentsError;

            const classIds = [
                ...new Set(
                    (students ?? [])
                        .map((student) => student.class_id)
                        .filter(Boolean)
                ),
            ];

            const [{ data: classes }, { data: schools }] = await Promise.all([
                classIds.length
                    ? supabase
                        .from('classes')
                        .select('id, name')
                        .in('id', classIds)
                    : Promise.resolve({ data: [] }),
                schoolIds.length
                    ? supabase
                        .from('schools')
                        .select('id, name')
                        .in('id', schoolIds)
                    : Promise.resolve({ data: [] }),
            ]);

            const classMap = new Map(
                (classes ?? []).map((item) => [item.id, item.name])
            );

            const schoolMap = new Map(
                (schools ?? []).map((item) => [item.id, item.name])
            );

            const studentMap = new Map(
                (students ?? []).map((item) => [item.id, item])
            );

            const childItems: ChildItem[] = relationships
                .map((relationship) => {
                    const student = studentMap.get(relationship.student_id);

                    if (!student) return null;

                    return {
                        id: student.id,
                        full_name: student.full_name,
                        admission_number: student.admission_number,
                        class_name: student.class_id
                            ? classMap.get(student.class_id) || 'Class not assigned'
                            : 'Class not assigned',
                        school_name:
                            schoolMap.get(relationship.school_id) ||
                            'School not available',
                        status: relationship.status,
                    };
                })
                .filter((item): item is ChildItem => item !== null);

            setChildren(childItems);
        } catch (error: any) {
            console.error('Profile loading error:', error);
            setLoadError(
                error?.message || 'Unable to load your profile information.'
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [router]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadProfile(false);
    };

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out of your SchoolView account?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase.auth.signOut();

                        if (error) {
                            Alert.alert('Unable to log out', error.message);
                            return;
                        }

                        router.replace('/(auth)/login');
                    },
                },
            ]
        );
    };

    const initial = parentName.trim().charAt(0).toUpperCase() || 'P';

    // Schools are derived from the children already loaded above.
    const schoolNames = useMemo(
        () => [...new Set(children.map((child) => child.school_name))],
        [children]
    );

    /* -------------------------------- Render -------------------------------- */

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Page header */}
            <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.pageTitle}>Profile</Text>
                    <Text style={styles.pageSubtitle} numberOfLines={1}>
                        Manage your account and children
                    </Text>
                </View>

                <Pressable
                    style={styles.bellButton}
                    onPress={() =>
                        router.push('/(parent)/profile/notifications')
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Notifications, ${unreadCount} unread`}
                >
                    <Icon name="bell" size={24} />

                    {unreadCount > 0 && (
                        <View style={styles.notificationBadge}>
                            <Text style={styles.notificationBadgeText}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </Pressable>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={COLORS.blue}
                    />
                }
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.blue} />
                        <Text style={styles.loadingText}>
                            Loading your profile...
                        </Text>
                    </View>
                ) : (
                    <>
                        {loadError ? (
                            <Pressable
                                style={styles.errorCard}
                                onPress={() => loadProfile()}
                            >
                                <Text style={styles.errorTitle}>
                                    Couldn't load everything
                                </Text>
                                <Text style={styles.errorText}>{loadError}</Text>
                                <Text style={styles.retryText}>
                                    Tap to try again
                                </Text>
                            </Pressable>
                        ) : null}

                        {/* Parent identity */}
                        <View style={styles.identityCard}>
                            <View style={styles.parentAvatarWrapper}>
                                {avatarUrl && !avatarFailed ? (
                                    <Image
                                        source={{ uri: avatarUrl }}
                                        style={styles.parentAvatar}
                                        onError={() => setAvatarFailed(true)}
                                    />
                                ) : (
                                    <Text style={styles.parentAvatarInitial}>
                                        {initial}
                                    </Text>
                                )}
                            </View>

                            <Text style={styles.parentName} numberOfLines={2}>
                                {parentName}
                            </Text>

                            <View style={styles.accountPill}>
                                <Text style={styles.accountPillText}>
                                    Parent Account
                                </Text>
                            </View>
                        </View>

                        {/* Account information */}
                        <SectionHeader title="Account Information" />

                        <View style={styles.groupCard}>
                            <InfoRow
                                icon="mail"
                                label="Email"
                                value={email || 'Not available'}
                            />
                            <InfoRow
                                icon="phone"
                                label="Phone"
                                value={phone || 'Not added'}
                                last
                            />
                        </View>

                        {/* Linked children */}
                        <SectionHeader
                            title="My Children"
                            actionLabel="Manage All"
                            onActionPress={() =>
                                router.push('/(parent)/profile/children')
                            }
                        />

                        {children.length > 0 ? (
                            <View style={styles.childList}>
                                {children.map((child) => {
                                    const approved = child.status === 'approved';

                                    return (
                                        <View
                                            key={child.id}
                                            style={styles.childCard}
                                        >
                                            <View style={styles.childAvatar}>
                                                <Text style={styles.childAvatarText}>
                                                    {child.full_name
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </Text>
                                            </View>

                                            <View style={styles.childDetails}>
                                                <Text
                                                    style={styles.childName}
                                                    numberOfLines={1}
                                                >
                                                    {child.full_name}
                                                </Text>

                                                <Text
                                                    style={styles.childMeta}
                                                    numberOfLines={1}
                                                >
                                                    {child.class_name}
                                                </Text>

                                                <Text
                                                    style={styles.childSchool}
                                                    numberOfLines={1}
                                                >
                                                    {child.school_name}
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.statusPill,
                                                    approved
                                                        ? styles.statusApproved
                                                        : styles.statusPending,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusText,
                                                        {
                                                            color: approved
                                                                ? COLORS.green
                                                                : COLORS.muted,
                                                        },
                                                    ]}
                                                >
                                                    {approved ? 'Approved' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.emptyCard}>
                                <View style={styles.emptyIconCircle}>
                                    <Icon name="user" size={26} />
                                </View>
                                <Text style={styles.emptyTitle}>
                                    No linked children yet
                                </Text>
                                <Text style={styles.emptyText}>
                                    Link your child to their school to manage
                                    their classroom access.
                                </Text>

                                <Pressable
                                    style={styles.primaryButton}
                                    onPress={() =>
                                        router.push('/(auth)/select-school')
                                    }
                                >
                                    <Text style={styles.primaryButtonText}>
                                        Link a child
                                    </Text>
                                </Pressable>
                            </View>
                        )}

                        {/* School associations */}
                        {schoolNames.length > 0 && (
                            <>
                                <SectionHeader
                                    title="Schools"
                                    actionLabel="View All"
                                    onActionPress={() => router.push(SCHOOL_ROUTE)}
                                />

                                <View style={styles.groupCard}>
                                    {schoolNames.map((name, index) => (
                                        <InfoRow
                                            key={name}
                                            icon="school"
                                            label="Linked school"
                                            value={name}
                                            last={index === schoolNames.length - 1}
                                            onPress={() => router.push(SCHOOL_ROUTE)}
                                        />
                                    ))}
                                </View>
                            </>
                        )}

                        {/* Account settings */}
                        <SectionHeader title="Account Settings" />

                        <View style={styles.groupCard}>
                            <ProfileRow
                                icon="user"
                                title="Account Settings"
                                description="Update your account details"
                                onPress={() =>
                                    router.push('/(parent)/profile/settings')
                                }
                            />

                            <ProfileRow
                                icon="bell"
                                title="Notification Preferences"
                                description="Choose what notifications you get"
                                badge={unreadCount}
                                onPress={() =>
                                    router.push('/(parent)/profile/notifications')
                                }
                                last
                            />
                        </View>

                        {/* Security and support */}
                        <SectionHeader title="Security & Support" />

                        <View style={styles.groupCard}>
                            <ProfileRow
                                icon="shield"
                                title="Privacy & Security"
                                description="Manage your privacy and security"
                                onPress={() =>
                                    router.push('/(parent)/profile/privacy')
                                }
                            />

                            <ProfileRow
                                icon="help"
                                title="Help & Support"
                                description="Get help or contact support"
                                onPress={() =>
                                    Alert.alert(
                                        'Help & Support',
                                        'Please contact your school administrator for assistance.'
                                    )
                                }
                            />

                            <ProfileRow
                                icon="info"
                                title="About SchoolView"
                                description="App version 1.0.0"
                                onPress={() =>
                                    Alert.alert(
                                        'About SchoolView',
                                        'SchoolView Parent App\nVersion 1.0.0'
                                    )
                                }
                                last
                            />
                        </View>

                        {/* Log out */}
                        <Pressable
                            style={styles.logoutButton}
                            onPress={handleLogout}
                            accessibilityRole="button"
                            accessibilityLabel="Log out"
                        >
                            <Icon name="logout" size={20} color={COLORS.red} />
                            <Text style={styles.logoutText}>Log Out</Text>
                        </Pressable>

                        <Text style={styles.versionText}>
                            SchoolView · Parent App
                        </Text>
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

    bellButton: {
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

    /* Scroll area */
    scrollView: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
    },

    /* Loading + error */
    loadingContainer: {
        paddingVertical: 80,
        alignItems: 'center',
        gap: 12,
    },

    loadingText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 14,
    },

    errorCard: {
        backgroundColor: COLORS.redSoft,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },

    errorTitle: {
        color: COLORS.red,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
    },

    errorText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 13.5,
        lineHeight: 20,
        marginTop: 4,
    },

    retryText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 13.5,
        marginTop: 8,
    },

    /* Identity card */
    identityCard: {
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 20,
        paddingVertical: 24,
        paddingHorizontal: 20,
    },

    parentAvatarWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        overflow: 'hidden',
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    parentAvatar: {
        width: '100%',
        height: '100%',
    },

    parentAvatarInitial: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 40,
    },

    parentName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 22,
        textAlign: 'center',
        marginTop: 14,
    },

    accountPill: {
        backgroundColor: COLORS.paleBlue,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 14,
        marginTop: 10,
    },

    accountPillText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 12.5,
    },

    /* Section header */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 28,
        marginBottom: 14,
    },

    sectionTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 20,
    },

    sectionAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },

    sectionActionText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
    },

    /* Grouped rows */
    groupCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        paddingHorizontal: 16,
    },

    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
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

    rowLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 12.5,
    },

    infoValue: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        marginTop: 1,
    },

    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 68,
        paddingVertical: 12,
    },

    settingTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
    },

    settingDescription: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        marginTop: 1,
    },

    rowBadge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.red,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 7,
    },

    rowBadgeText: {
        color: COLORS.white,
        fontFamily: FONTS.bodyBold,
        fontSize: 11.5,
    },

    /* Children */
    childList: {
        gap: 12,
    },

    childCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 14,
    },

    childAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    childAvatarText: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 22,
    },

    childDetails: {
        flex: 1,
        minWidth: 0,
    },

    childName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 17,
    },

    childMeta: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyMedium,
        fontSize: 13.5,
        marginTop: 2,
    },

    childSchool: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 12.5,
        marginTop: 1,
    },

    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },

    statusApproved: {
        backgroundColor: COLORS.greenSoft,
    },

    statusPending: {
        backgroundColor: COLORS.greySoft,
    },

    statusText: {
        fontFamily: FONTS.bodyBold,
        fontSize: 11.5,
    },

    /* Empty state */
    emptyCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 26,
        alignItems: 'center',
    },

    emptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },

    emptyTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 18,
        textAlign: 'center',
    },

    emptyText: {
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

    /* Log out */
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 54,
        marginTop: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.red,
        backgroundColor: COLORS.white,
    },

    logoutText: {
        color: COLORS.red,
        fontFamily: FONTS.bodyBold,
        fontSize: 16,
    },

    versionText: {
        textAlign: 'center',
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 12,
        marginTop: 24,
    },
});