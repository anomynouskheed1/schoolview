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

type Child = {
    id: string;
    studentId: string;
    name: string;
    admissionNumber: string;
    relationship: string;
    status: 'approved' | 'pending';
    schoolName: string;
    className: string;
    academicYear: string;
};

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

function Icon({
    name,
    size = 22,
    color = COLORS.blue,
}: {
    name: 'back' | 'plus' | 'users' | 'info';
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
            {name === 'users' && (
                <>
                    <Path
                        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                        {...common}
                    />
                    <Circle cx={9} cy={7} r={4} {...common} />
                    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...common} />
                    <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...common} />
                </>
            )}
            {name === 'info' && (
                <>
                    <Circle cx={12} cy={12} r={10} {...common} />
                    <Path d="M12 16v-4M12 8h.01" {...common} />
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

function DetailRow({
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

export default function ChildrenScreen() {
    const router = useRouter();

    const [children, setChildren] = useState<Child[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    /* ---------------------------- Data (unchanged) ---------------------------- */

    const loadChildren = useCallback(async () => {
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
                .select('id, student_id, school_id, relationship, status')
                .eq('parent_id', user.id)
                .in('status', ['approved', 'pending']);

            if (linksError) throw linksError;

            if (!links || links.length === 0) {
                setChildren([]);
                return;
            }

            const studentIds = [
                ...new Set(links.map((link) => link.student_id)),
            ];

            const schoolIds = [
                ...new Set(links.map((link) => link.school_id)),
            ];

            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('id, full_name, admission_number, class_id')
                .in('id', studentIds);

            if (studentsError) throw studentsError;

            const classIds = [
                ...new Set(
                    (students ?? [])
                        .map((student) => student.class_id)
                        .filter((id): id is string => Boolean(id))
                ),
            ];

            const [schoolsResult, classesResult] = await Promise.all([
                supabase
                    .from('schools')
                    .select('id, name')
                    .in('id', schoolIds),

                classIds.length > 0
                    ? supabase
                        .from('classes')
                        .select('id, name, academic_year')
                        .in('id', classIds)
                    : Promise.resolve({
                        data: [],
                        error: null,
                    }),
            ]);

            if (schoolsResult.error) throw schoolsResult.error;
            if (classesResult.error) throw classesResult.error;

            const studentMap = new Map(
                (students ?? []).map((student) => [
                    student.id,
                    student,
                ])
            );

            const schoolMap = new Map(
                (schoolsResult.data ?? []).map((school) => [
                    school.id,
                    school.name,
                ])
            );

            const classMap = new Map(
                (classesResult.data ?? []).map((classItem) => [
                    classItem.id,
                    classItem,
                ])
            );

            const formattedChildren: Child[] = links
                .map((link) => {
                    const student = studentMap.get(link.student_id);

                    if (!student) return null;

                    const classItem = student.class_id
                        ? classMap.get(student.class_id)
                        : null;

                    return {
                        id: link.id,
                        studentId: student.id,
                        name: student.full_name,
                        admissionNumber: student.admission_number,
                        relationship: link.relationship,
                        status: link.status as 'approved' | 'pending',
                        schoolName:
                            schoolMap.get(link.school_id) ?? 'School unavailable',
                        className: classItem?.name ?? 'Class not assigned',
                        academicYear: classItem?.academic_year ?? '',
                    };
                })
                .filter((child): child is Child => child !== null);

            setChildren(formattedChildren);
        } catch (err) {
            console.error('Children loading error:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load your children.'
            );
        }
    }, [router]);

    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            await loadChildren();
            setLoading(false);
        };

        initialize();
    }, [loadChildren]);

    const refreshChildren = async () => {
        setRefreshing(true);
        await loadChildren();
        setRefreshing(false);
    };

    const startLinkingChild = () => {
        router.push('/(auth)/select-school');
    };

    /* -------------------------------- Render -------------------------------- */

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <PageHeader
                    title="My Children"
                    subtitle="Children linked to your account"
                    onBack={() => router.back()}
                />

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.blue} />
                    <Text style={styles.loadingText}>
                        Loading your children...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <PageHeader
                title="My Children"
                subtitle="Children linked to your account"
                onBack={() => router.back()}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshChildren}
                        tintColor={COLORS.blue}
                    />
                }
            >
                {error ? (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>
                            Unable to load children
                        </Text>
                        <Text style={styles.errorText}>{error}</Text>

                        <Pressable
                            style={styles.primaryButton}
                            onPress={refreshChildren}
                        >
                            <Text style={styles.primaryButtonText}>
                                Try again
                            </Text>
                        </Pressable>
                    </View>
                ) : children.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Icon name="users" size={28} />
                        </View>

                        <Text style={styles.emptyTitle}>
                            No linked children yet
                        </Text>

                        <Text style={styles.emptyText}>
                            Children linked to your parent account will appear
                            here after you submit a request to their school.
                            Approved children will show their school and class
                            information.
                        </Text>

                        <Pressable
                            style={styles.primaryButton}
                            onPress={startLinkingChild}
                        >
                            <Icon name="plus" size={18} color={COLORS.white} />
                            <Text style={styles.primaryButtonText}>
                                Link a child
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        {/* Summary */}
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryIconCircle}>
                                <Icon name="users" size={22} />
                            </View>

                            <View style={styles.summaryTextWrap}>
                                <Text style={styles.summaryNumber}>
                                    {children.length}
                                </Text>
                                <Text style={styles.summaryLabel}>
                                    {children.length === 1
                                        ? 'Child linked to your account'
                                        : 'Children linked to your account'}
                                </Text>
                            </View>
                        </View>

                        {/* Children */}
                        <View style={styles.childList}>
                            {children.map((child) => {
                                const approved = child.status === 'approved';

                                return (
                                    <View key={child.id} style={styles.childCard}>
                                        <View style={styles.childTop}>
                                            <View style={styles.avatar}>
                                                <Text style={styles.avatarText}>
                                                    {child.name
                                                        .trim()
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </Text>
                                            </View>

                                            <View style={styles.childIdentity}>
                                                <Text
                                                    style={styles.childName}
                                                    numberOfLines={2}
                                                >
                                                    {child.name}
                                                </Text>
                                                <Text style={styles.admission}>
                                                    Admission: {child.admissionNumber}
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

                                        <View style={styles.childDivider} />

                                        <DetailRow
                                            label="School"
                                            value={child.schoolName}
                                        />

                                        <DetailRow
                                            label="Class"
                                            value={child.className}
                                        />

                                        {child.academicYear ? (
                                            <DetailRow
                                                label="Academic year"
                                                value={child.academicYear}
                                            />
                                        ) : null}

                                        <DetailRow
                                            label="Relationship"
                                            value={child.relationship}
                                            last
                                        />

                                        {child.status === 'pending' && (
                                            <View style={styles.pendingNote}>
                                                <Icon name="info" size={18} />
                                                <Text style={styles.pendingNoteText}>
                                                    Your school is reviewing this
                                                    parent-child link request.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        <Pressable
                            style={styles.addAnotherButton}
                            onPress={startLinkingChild}
                            accessibilityRole="button"
                        >
                            <Icon name="plus" size={18} />
                            <Text style={styles.addAnotherText}>
                                Link another child
                            </Text>
                        </Pressable>
                    </>
                )}

                {/* Information */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Child information</Text>
                    <Text style={styles.infoText}>
                        Each child has their own school relationship, class
                        information and classroom viewing permissions.
                        Classroom access is managed separately by the school.
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

    /* Child cards */
    childList: {
        gap: 14,
        marginTop: 16,
    },

    childCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    childTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },

    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    avatarText: {
        color: COLORS.blue,
        fontFamily: FONTS.heading,
        fontSize: 21,
    },

    childIdentity: {
        flex: 1,
        minWidth: 0,
    },

    childName: {
        color: COLORS.charcoal,
        fontFamily: FONTS.heading,
        fontSize: 17,
    },

    admission: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
        marginTop: 2,
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

    childDivider: {
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

    pendingNoteText: {
        flex: 1,
        color: COLORS.charcoal,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
    },

    /* Buttons */
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 48,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        paddingHorizontal: 26,
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