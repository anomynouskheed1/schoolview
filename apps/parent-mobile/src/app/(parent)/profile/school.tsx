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
import Svg, { Circle, Path } from 'react-native-svg';
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

type School = {
    id: string;
    name: string;
    school_code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    county: string | null;
    status: string;
};

type SchoolConnection = {
    school: School;
    childCount: number;
    approvedCount: number;
    pendingCount: number;
};

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

function Icon({
    name,
    size = 22,
    color = COLORS.blue,
}: {
    name: 'back' | 'plus' | 'school' | 'info' | 'check';
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
            {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}
            {name === 'school' && (
                <>
                    <Path d="M3 21h18" {...common} />
                    <Path d="M5 21V7l7-4 7 4v14" {...common} />
                    <Path d="M9 21v-6h6v6" {...common} />
                </>
            )}
            {name === 'info' && (
                <>
                    <Circle cx={12} cy={12} r={10} {...common} />
                    <Path d="M12 16v-4M12 8h.01" {...common} />
                </>
            )}
            {name === 'check' && (
                <>
                    <Circle cx={12} cy={12} r={10} {...common} />
                    <Path d="M8 12l3 3 5-6" {...common} />
                </>
            )}
        </Svg>
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

function SchoolDetail({
    label,
    value,
    last = false,
}: {
    label: string;
    value: string;
    last?: boolean;
}) {
    return (
        <View style={[styles.detailRow, !last && styles.detailDivider]}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function ParentSchoolScreen() {
    const router = useRouter();

    const [schools, setSchools] = useState<SchoolConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    /* ---------------------------- Data (unchanged) ---------------------------- */

    const loadSchools = useCallback(async () => {
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
                .select('student_id, school_id, status')
                .eq('parent_id', user.id)
                .in('status', ['approved', 'pending']);

            if (linksError) throw linksError;

            if (!links || links.length === 0) {
                setSchools([]);
                return;
            }

            const schoolIds = [
                ...new Set(links.map((link) => link.school_id)),
            ];

            const { data: schoolRecords, error: schoolError } =
                await supabase
                    .from('schools')
                    .select(
                        'id, name, school_code, email, phone, address, county, status'
                    )
                    .in('id', schoolIds);

            if (schoolError) throw schoolError;

            const connections: SchoolConnection[] = (
                schoolRecords ?? []
            ).map((school) => {
                const schoolLinks = links.filter(
                    (link) => link.school_id === school.id
                );

                return {
                    school: school as School,
                    childCount: new Set(
                        schoolLinks.map((link) => link.student_id)
                    ).size,
                    approvedCount: schoolLinks.filter(
                        (link) => link.status === 'approved'
                    ).length,
                    pendingCount: schoolLinks.filter(
                        (link) => link.status === 'pending'
                    ).length,
                };
            });

            setSchools(connections);
        } catch (err) {
            console.error('School information loading error:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load your school information.'
            );
        }
    }, [router]);

    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            await loadSchools();
            setLoading(false);
        };

        initialize();
    }, [loadSchools]);

    const refreshSchools = async () => {
        setRefreshing(true);
        await loadSchools();
        setRefreshing(false);
    };

    const registerAnotherChild = () => {
        router.push('/(auth)/select-school');
    };

    /* -------------------------------- Render -------------------------------- */

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <PageHeader
                    title="My School"
                    subtitle="Your registered school"
                    onBack={() => router.back()}
                />

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.blue} />
                    <Text style={styles.loadingText}>
                        Loading school information...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <PageHeader
                title="My School"
                subtitle="Your registered school"
                onBack={() => router.back()}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshSchools}
                        tintColor={COLORS.blue}
                    />
                }
            >
                {error ? (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>
                            Unable to load school information
                        </Text>
                        <Text style={styles.errorText}>{error}</Text>

                        <Pressable
                            style={styles.primaryButton}
                            onPress={refreshSchools}
                        >
                            <Text style={styles.primaryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : schools.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Icon name="school" size={28} />
                        </View>

                        <Text style={styles.emptyTitle}>
                            No school linked yet
                        </Text>

                        <Text style={styles.emptyText}>
                            Your school details will appear here after you
                            submit a child-link request to a registered school.
                        </Text>

                        <Pressable
                            style={styles.primaryButton}
                            onPress={registerAnotherChild}
                        >
                            <Text style={styles.primaryButtonText}>
                                Find a school
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {/* Summary */}
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryIconCircle}>
                                <Icon name="school" size={22} />
                            </View>

                            <View style={styles.summaryTextWrap}>
                                <Text style={styles.summaryNumber}>
                                    {schools.length}
                                </Text>
                                <Text style={styles.summaryLabel}>
                                    {schools.length === 1
                                        ? 'School connected to your account'
                                        : 'Schools connected to your account'}
                                </Text>
                            </View>
                        </View>

                        {/* Schools */}
                        <View style={styles.schoolList}>
                            {schools.map((connection) => {
                                const { school } = connection;

                                const allApproved =
                                    connection.approvedCount > 0 &&
                                    connection.pendingCount === 0;

                                return (
                                    <View
                                        key={school.id}
                                        style={styles.schoolCard}
                                    >
                                        <View style={styles.schoolHeader}>
                                            <View style={styles.schoolIcon}>
                                                <Icon name="school" size={24} />
                                            </View>

                                            <View style={styles.schoolIdentity}>
                                                <Text
                                                    style={styles.schoolName}
                                                    numberOfLines={2}
                                                >
                                                    {school.name}
                                                </Text>
                                                <Text style={styles.schoolCode}>
                                                    Code: {school.school_code}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.statusRow}>
                                            <View
                                                style={[
                                                    styles.statusPill,
                                                    allApproved
                                                        ? styles.statusApproved
                                                        : styles.statusPending,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusText,
                                                        {
                                                            color: allApproved
                                                                ? COLORS.green
                                                                : COLORS.muted,
                                                        },
                                                    ]}
                                                >
                                                    {allApproved
                                                        ? 'Approved connection'
                                                        : 'Pending review'}
                                                </Text>
                                            </View>

                                            <Text style={styles.childCount}>
                                                {connection.childCount}{' '}
                                                {connection.childCount === 1
                                                    ? 'child'
                                                    : 'children'}
                                            </Text>
                                        </View>

                                        <View style={styles.divider} />

                                        <SchoolDetail
                                            label="County"
                                            value={school.county || 'Not provided'}
                                        />

                                        <SchoolDetail
                                            label="Address"
                                            value={school.address || 'Not provided'}
                                        />

                                        <SchoolDetail
                                            label="Phone"
                                            value={school.phone || 'Not provided'}
                                        />

                                        <SchoolDetail
                                            label="Email"
                                            value={school.email || 'Not provided'}
                                            last
                                        />

                                        {connection.pendingCount > 0 && (
                                            <View style={styles.pendingNote}>
                                                <Icon name="info" size={18} />
                                                <Text style={styles.noteText}>
                                                    {connection.pendingCount === 1
                                                        ? 'One child-link request is awaiting school approval.'
                                                        : `${connection.pendingCount} child-link requests are awaiting school approval.`}
                                                </Text>
                                            </View>
                                        )}

                                        {connection.approvedCount > 0 && (
                                            <View style={styles.approvedNote}>
                                                <Icon
                                                    name="check"
                                                    size={18}
                                                    color={COLORS.green}
                                                />
                                                <Text style={styles.noteText}>
                                                    {connection.approvedCount}{' '}
                                                    {connection.approvedCount === 1
                                                        ? 'child is'
                                                        : 'children are'}{' '}
                                                    approved by this school.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        <Pressable
                            style={styles.addAnotherButton}
                            onPress={registerAnotherChild}
                            accessibilityRole="button"
                        >
                            <Icon name="plus" size={18} />
                            <Text style={styles.addAnotherText}>
                                Register another child
                            </Text>
                        </Pressable>
                    </>
                )}

                {/* Information */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>School connection</Text>
                    <Text style={styles.infoText}>
                        Your school manages your linked children, classroom
                        permissions and school announcements. Classroom viewing
                        access is granted separately by the school.
                    </Text>
                </View>
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

    content: {
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

    /* Summary */
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    summaryIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    summaryTextWrap: {
        flex: 1,
    },

    summaryNumber: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 24,
    },

    summaryLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 13.5,
    },

    /* School cards */
    schoolList: {
        gap: 14,
        marginTop: 16,
    },

    schoolCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    schoolHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    schoolIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    schoolIdentity: {
        flex: 1,
        minWidth: 0,
    },

    schoolName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 18,
    },

    schoolCode: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        marginTop: 2,
    },

    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
    },

    statusPill: {
        paddingHorizontal: 11,
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
        fontSize: 12,
    },

    childCount: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyBold,
        fontSize: 13,
    },

    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 14,
    },

    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
    },

    detailDivider: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    detailLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
        fontSize: 14,
    },

    detailValue: {
        flex: 1,
        textAlign: 'right',
        marginLeft: 16,
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
    },

    pendingNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: COLORS.paleBlue,
        borderRadius: 12,
        padding: 12,
        marginTop: 14,
    },

    approvedNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: COLORS.greenSoft,
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
    },

    noteText: {
        flex: 1,
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
    },

    /* Buttons */
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

    addAnotherButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 50,
        marginTop: 18,
        borderWidth: 1,
        borderColor: COLORS.blue,
        borderRadius: 14,
        backgroundColor: COLORS.white,
    },

    addAnotherText: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
    },

    /* Empty + error */
    emptyCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 26,
        alignItems: 'center',
    },

    emptyIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
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

    errorCard: {
        backgroundColor: COLORS.redSoft,
        borderRadius: 18,
        padding: 18,
    },

    errorTitle: {
        color: COLORS.red,
        fontFamily: FONTS.bodyBold,
        fontSize: 15.5,
    },

    errorText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 6,
    },

    /* Info */
    infoCard: {
        backgroundColor: COLORS.paleBlue,
        borderRadius: 18,
        padding: 18,
        marginTop: 24,
    },

    infoTitle: {
        color: COLORS.charcoal,
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
    },

    infoText: {
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
        marginTop: 5,
    },
});