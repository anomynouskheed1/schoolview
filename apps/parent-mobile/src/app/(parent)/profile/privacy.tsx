import { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
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

type PrivacyData = {
    approvedLinks: number;
    pendingLinks: number;
    activeGrants: number;
    expiredGrants: number;
    revokedGrants: number;
    totalGrants: number;
};

const INITIAL_DATA: PrivacyData = {
    approvedLinks: 0,
    pendingLinks: 0,
    activeGrants: 0,
    expiredGrants: 0,
    revokedGrants: 0,
    totalGrants: 0,
};

type IconName =
    | 'back'
    | 'users'
    | 'video'
    | 'lock'
    | 'user'
    | 'shield'
    | 'mail'
    | 'info';

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
            {name === 'users' && (
                <>
                    <Circle cx={9} cy={8} r={3.5} {...common} />
                    <Path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" {...common} />
                    <Circle cx={17} cy={9} r={2.5} {...common} />
                    <Path d="M17 14.5c2.5 0 4.5 1.8 4.5 4.5" {...common} />
                </>
            )}
            {name === 'video' && (
                <>
                    <Rect x={2} y={6} width={14} height={12} rx={2} {...common} />
                    <Path d="M16 10l6-3v10l-6-3" {...common} />
                </>
            )}
            {name === 'lock' && (
                <>
                    <Rect x={5} y={11} width={14} height={9} rx={2} {...common} />
                    <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...common} />
                </>
            )}
            {name === 'user' && (
                <>
                    <Circle cx={12} cy={8} r={4} {...common} />
                    <Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" {...common} />
                </>
            )}
            {name === 'shield' && (
                <>
                    <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" {...common} />
                    <Path d="M9 12l2 2 4-4" {...common} />
                </>
            )}
            {name === 'mail' && (
                <>
                    <Rect x={3} y={5} width={18} height={14} rx={2} {...common} />
                    <Path d="M3 7l9 6 9-6" {...common} />
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

export default function PrivacyScreen() {
    const router = useRouter();

    const [data, setData] = useState<PrivacyData>(INITIAL_DATA);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const loadPrivacyData = useCallback(async () => {
        try {
            setError('');

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                router.replace('/(auth)/login');
                return;
            }

            const { data: links, error: linksError } = await supabase
                .from('parent_students')
                .select('id, status')
                .eq('parent_id', user.id);

            if (linksError) throw linksError;

            const approvedLinks = (links ?? []).filter(
                (link) => link.status === 'approved'
            );

            const pendingLinks = (links ?? []).filter(
                (link) => link.status === 'pending'
            );

            const approvedLinkIds = approvedLinks.map((link) => link.id);

            if (approvedLinkIds.length === 0) {
                setData({
                    ...INITIAL_DATA,
                    pendingLinks: pendingLinks.length,
                });
                return;
            }

            const { data: grants, error: grantsError } = await supabase
                .from('camera_access')
                .select(
                    'id, parent_student_id, expires_at, revoked_at'
                )
                .in('parent_student_id', approvedLinkIds);

            if (grantsError) throw grantsError;

            const now = Date.now();

            let activeGrants = 0;
            let expiredGrants = 0;
            let revokedGrants = 0;

            (grants ?? []).forEach((grant) => {
                if (grant.revoked_at) {
                    revokedGrants++;
                    return;
                }

                if (
                    grant.expires_at &&
                    new Date(grant.expires_at).getTime() <= now
                ) {
                    expiredGrants++;
                    return;
                }

                activeGrants++;
            });

            setData({
                approvedLinks: approvedLinks.length,
                pendingLinks: pendingLinks.length,
                activeGrants,
                expiredGrants,
                revokedGrants,
                totalGrants: (grants ?? []).length,
            });
        } catch (err) {
            console.error('Privacy information loading error:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load your privacy information.'
            );
        }
    }, [router]);

    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            await loadPrivacyData();
            setLoading(false);
        };

        initialize();
    }, [loadPrivacyData]);

    const refreshData = async () => {
        setRefreshing(true);
        await loadPrivacyData();
        setRefreshing(false);
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
                    <Text style={styles.title}>Privacy & Security</Text>
                    <Text style={styles.subtitle}>
                        How SchoolView protects your account and classroom
                        access.
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <View style={styles.stateCard}>
                        <ActivityIndicator size="large" color={COLORS.blue} />
                        <Text style={styles.stateText}>
                            Checking your privacy information...
                        </Text>
                    </View>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refreshData}
                            tintColor={COLORS.blue}
                            colors={[COLORS.blue]}
                        />
                    }
                >
                    {error ? (
                        <View style={[styles.stateCard, styles.errorCard]}>
                            <Text style={styles.errorTitle}>
                                Unable to load access information
                            </Text>
                            <Text style={styles.errorText}>{error}</Text>

                            <Pressable
                                style={styles.retryButton}
                                onPress={refreshData}
                                accessibilityRole="button"
                                accessibilityLabel="Try loading access information again"
                            >
                                <Text style={styles.retryText}>Try again</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>
                                Your classroom access
                            </Text>

                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.iconCircle}>
                                        <Icon name="users" size={22} />
                                    </View>
                                    <View style={styles.cardHeaderText}>
                                        <Text style={styles.cardTitle}>
                                            Parent-child connections
                                        </Text>
                                    </View>
                                    <Text
                                        style={styles.bigNumber}
                                        accessibilityLabel={`${data.approvedLinks} approved connections`}
                                    >
                                        {data.approvedLinks}
                                    </Text>
                                </View>

                                <Text style={styles.cardDescription}>
                                    Approved child relationships connected to
                                    your account.
                                </Text>

                                <View style={styles.divider} />

                                <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>
                                        Approved relationships
                                    </Text>
                                    <View style={styles.greenPill}>
                                        <Text style={styles.greenPillText}>
                                            {data.approvedLinks}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>
                                        Pending relationships
                                    </Text>
                                    <View style={styles.greyPill}>
                                        <Text style={styles.greyPillText}>
                                            {data.pendingLinks}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.iconCircle}>
                                        <Icon name="video" size={22} />
                                    </View>
                                    <View style={styles.cardHeaderText}>
                                        <Text style={styles.cardTitle}>
                                            Camera access grants
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.cardDescription}>
                                    Access permissions granted by your school
                                    for approved child relationships.
                                </Text>

                                <View style={styles.grantGrid}>
                                    <GrantStat
                                        value={data.activeGrants}
                                        label="Active"
                                        color={COLORS.green}
                                        background={COLORS.greenSoft}
                                    />

                                    <GrantStat
                                        value={data.expiredGrants}
                                        label="Expired"
                                        color={COLORS.muted}
                                        background={COLORS.greySoft}
                                    />

                                    <GrantStat
                                        value={data.revokedGrants}
                                        label="Revoked"
                                        color={COLORS.red}
                                        background={COLORS.redSoft}
                                    />
                                </View>

                                {data.totalGrants === 0 && (
                                    <Text style={styles.noGrantText}>
                                        No camera access grants are currently
                                        recorded for your approved child
                                        relationships.
                                    </Text>
                                )}

                                <Text style={styles.footnote}>
                                    Active grants do not guarantee that a
                                    classroom stream is currently available.
                                    School settings and camera availability
                                    also affect playback.
                                </Text>
                            </View>
                        </>
                    )}

                    <Text style={styles.sectionTitle}>
                        Privacy protection
                    </Text>

                    <PrivacyCard
                        icon="lock"
                        title="Account protection"
                        description="Your account information is protected through authenticated sessions. Never share your password or sign-in verification links with anyone."
                    />

                    <PrivacyCard
                        icon="user"
                        title="Child information"
                        description="Only children linked to your parent account through the school's approval process should be accessible to you."
                    />

                    <PrivacyCard
                        icon="video"
                        title="Classroom access"
                        description="School administrators control which approved parents receive access to individual classroom cameras. Access can be revoked or expire."
                    />

                    <PrivacyCard
                        icon="shield"
                        title="Secure video"
                        description="Classroom streams should use authorized, temporary playback credentials rather than publicly accessible camera URLs."
                    />

                    <PrivacyCard
                        icon="mail"
                        title="Data and privacy requests"
                        description="For requests to access, correct or delete your personal information, contact your school or the platform's designated privacy contact. An in-app privacy request workflow is not currently available."
                    />

                    <View style={styles.noteBox}>
                        <View style={styles.noteIcon}>
                            <Icon name="info" size={18} />
                        </View>
                        <View style={styles.noteBody}>
                            <Text style={styles.noteTitle}>
                                Your privacy matters
                            </Text>
                            <Text style={styles.noteText}>
                                SchoolView must maintain appropriate privacy
                                and security safeguards and comply with
                                applicable data protection requirements before
                                classroom monitoring goes live.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function GrantStat({
    value,
    label,
    color,
    background,
}: {
    value: number;
    label: string;
    color: string;
    background: string;
}) {
    return (
        <View
            style={[styles.grantStat, { backgroundColor: background }]}
            accessible
            accessibilityLabel={`${label} grants: ${value}`}
        >
            <Text style={[styles.grantNumber, { color }]}>{value}</Text>
            <Text style={[styles.grantLabel, { color }]}>{label}</Text>
        </View>
    );
}

function PrivacyCard({
    icon,
    title,
    description,
}: {
    icon: IconName;
    title: string;
    description: string;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                    <Icon name={icon} size={20} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{title}</Text>
                </View>
            </View>
            <Text style={styles.cardDescription}>{description}</Text>
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
        lineHeight: 19,
        fontFamily: FONTS.serif,
        marginTop: 2,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingWrap: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        color: COLORS.charcoal,
        fontSize: 20,
        fontFamily: FONTS.heading,
        marginTop: 8,
        marginBottom: 2,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
        marginTop: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderText: {
        flex: 1,
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
    cardTitle: {
        color: COLORS.charcoal,
        fontSize: 16,
        fontFamily: FONTS.bodyBold,
    },
    cardDescription: {
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: FONTS.body,
        marginTop: 10,
    },
    bigNumber: {
        color: COLORS.blue,
        fontSize: 26,
        fontFamily: FONTS.heading,
        marginLeft: 8,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 12,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    statLabel: {
        color: COLORS.muted,
        fontSize: 13,
        fontFamily: FONTS.bodyMedium,
    },
    greenPill: {
        backgroundColor: COLORS.greenSoft,
        borderRadius: 999,
        minWidth: 34,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignItems: 'center',
    },
    greenPillText: {
        color: COLORS.green,
        fontSize: 13,
        fontFamily: FONTS.bodyBold,
    },
    greyPill: {
        backgroundColor: COLORS.greySoft,
        borderRadius: 999,
        minWidth: 34,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignItems: 'center',
    },
    greyPillText: {
        color: COLORS.muted,
        fontSize: 13,
        fontFamily: FONTS.bodyBold,
    },
    grantGrid: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
    },
    grantStat: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    grantNumber: {
        fontSize: 24,
        fontFamily: FONTS.heading,
    },
    grantLabel: {
        fontSize: 12,
        fontFamily: FONTS.bodyBold,
        marginTop: 2,
    },
    noGrantText: {
        color: COLORS.muted,
        fontSize: 12.5,
        lineHeight: 19,
        fontFamily: FONTS.bodyMedium,
        marginTop: 14,
    },
    footnote: {
        color: COLORS.muted,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: FONTS.body,
        marginTop: 14,
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
        marginTop: 4,
        marginBottom: 12,
    },
    errorTitle: {
        color: COLORS.red,
        fontSize: 15,
        fontFamily: FONTS.bodyBold,
        textAlign: 'center',
    },
    errorText: {
        color: COLORS.charcoal,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.body,
        textAlign: 'center',
        marginTop: 8,
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
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.paleBlue,
        borderRadius: 14,
        padding: 16,
        marginTop: 16,
    },
    noteIcon: {
        marginRight: 10,
        marginTop: 1,
    },
    noteBody: {
        flex: 1,
    },
    noteTitle: {
        color: COLORS.charcoal,
        fontSize: 14,
        fontFamily: FONTS.bodyBold,
    },
    noteText: {
        color: COLORS.charcoal,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: FONTS.body,
        marginTop: 4,
    },
});