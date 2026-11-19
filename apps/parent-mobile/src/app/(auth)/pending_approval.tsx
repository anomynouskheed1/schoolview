import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
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

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

type StudentRelation = {
    full_name: string;
    admission_number: string;
};

type RequestRecord = {
    id: string;
    status: RequestStatus;
    students: StudentRelation | StudentRelation[] | null;
};

type IconName = 'clock' | 'check' | 'alert' | 'bell';

function Icon({
    name,
    size = 22,
    color = COLORS.charcoal,
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
            {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...common} />}
            {name === 'clock' && (
                <>
                    <Circle cx="12" cy="12" r="9" {...common} />
                    <Path d="M12 7v5l3 2" {...common} />
                </>
            )}
            {name === 'alert' && (
                <>
                    <Circle cx="12" cy="12" r="9" {...common} />
                    <Path d="M12 7.5v5" {...common} />
                    <Path d="M12 16.2v.01" {...common} />
                </>
            )}
            {name === 'bell' && (
                <>
                    <Path d="M6 16.5V11a6 6 0 1112 0v5.5l1.5 1.5h-15L6 16.5z" {...common} />
                    <Path d="M10 20.5a2 2 0 004 0" {...common} />
                </>
            )}
        </Svg>
    );
}

function BrandHeader() {
    return (
        <View style={styles.header}>
            <View style={styles.logo}>
                <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.brand}>SchoolView</Text>
        </View>
    );
}

export default function PendingApprovalScreen() {
    const router = useRouter();

    const params = useLocalSearchParams<{
        schoolId?: string;
        schoolName?: string;
        childName?: string;
        admissionNumber?: string;
    }>();

    const [checking, setChecking] = useState(false);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<RequestStatus>('pending');
    const [hasChecked, setHasChecked] = useState(false);

    const checkStatus = useCallback(async () => {
        if (!params.schoolId || !params.admissionNumber) {
            setMessage(
                'Registration details are missing. Please log in again or contact the school.'
            );
            return;
        }

        setChecking(true);
        setMessage('');

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('Your session has expired. Please log in again.');
            }

            const { data, error } = await supabase
                .from('parent_students')
                .select(`
                    id,
                    status,
                    students!inner (
                        full_name,
                        admission_number
                    )
                `)
                .eq('parent_id', user.id)
                .eq('school_id', params.schoolId);

            if (error) {
                throw error;
            }

            const requests = (data ?? []) as unknown as RequestRecord[];

            const matchingRequest = requests.find((request) => {
                const student = Array.isArray(request.students)
                    ? request.students[0]
                    : request.students;

                return (
                    student?.admission_number?.trim().toLowerCase() ===
                    params.admissionNumber?.trim().toLowerCase()
                );
            });

            if (!matchingRequest) {
                throw new Error(
                    'We could not find your registration request. Please contact the school administrator.'
                );
            }

            const currentStatus = matchingRequest.status;

            if (
                !['pending', 'approved', 'rejected', 'revoked'].includes(
                    currentStatus
                )
            ) {
                throw new Error('The request returned an unknown status.');
            }

            setStatus(currentStatus);
            setHasChecked(true);

            if (currentStatus === 'pending') {
                setMessage('Your request is still awaiting school approval.');
            } else if (currentStatus === 'approved') {
                setMessage('Your parent-child registration has been approved!');
            } else if (currentStatus === 'rejected') {
                setMessage(
                    'Your request was rejected. Please contact the school administrator for assistance.'
                );
            } else {
                setMessage(
                    'Your parent-child access has been revoked. Please contact the school.'
                );
            }
        } catch (error: unknown) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to retrieve your approval status. Please try again.'
            );
        } finally {
            setChecking(false);
        }
    }, [params.schoolId, params.admissionNumber]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const isApproved = status === 'approved';
    const isRejected = status === 'rejected' || status === 'revoked';

    // Pending is grey, approved is green, rejected / revoked is red.
    const statusLabel = isApproved
        ? 'Approved'
        : isRejected
            ? status === 'revoked'
                ? 'Access revoked'
                : 'Rejected'
            : 'Pending approval';

    const statusColor = isApproved
        ? COLORS.green
        : isRejected
            ? COLORS.red
            : COLORS.muted;

    const statusSoft = isApproved
        ? COLORS.greenSoft
        : isRejected
            ? COLORS.redSoft
            : COLORS.greySoft;

    const statusTitle = isApproved
        ? 'Your registration is approved!'
        : isRejected
            ? status === 'revoked'
                ? 'Access has been revoked'
                : 'Registration was rejected'
            : 'Awaiting school approval';

    const statusDescription = isApproved
        ? 'The school has confirmed your relationship with the child. You can continue to your parent dashboard.'
        : isRejected
            ? 'Please contact the school administrator if you need assistance with your registration.'
            : 'Your registration request is waiting for the school administrator to review your details.';

    // Message tone: approved = green, still pending = grey, anything else = red.
    const isPendingInfo =
        !isApproved &&
        !isRejected &&
        message === 'Your request is still awaiting school approval.';

    const messageSoft = isApproved
        ? COLORS.greenSoft
        : isPendingInfo
            ? COLORS.greySoft
            : COLORS.redSoft;

    const messageColor = isApproved
        ? COLORS.green
        : isPendingInfo
            ? COLORS.muted
            : COLORS.red;

    const messageIcon: IconName = isApproved
        ? 'check'
        : isPendingInfo
            ? 'clock'
            : 'alert';

    const detailRows = [
        { label: 'School', value: params.schoolName },
        { label: "Child's name", value: params.childName },
        { label: 'Admission number', value: params.admissionNumber },
    ];

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={checking && hasChecked}
                        onRefresh={checkStatus}
                        tintColor={COLORS.blue}
                        colors={[COLORS.blue]}
                    />
                }
            >
                <BrandHeader />

                {/* Status illustration */}
                <View style={styles.statusIllustration}>
                    <View
                        style={[
                            styles.outerCircle,
                            { backgroundColor: statusSoft },
                        ]}
                    >
                        <View style={styles.innerCircle}>
                            <Icon
                                name={
                                    isApproved
                                        ? 'check'
                                        : isRejected
                                            ? 'alert'
                                            : 'clock'
                                }
                                size={44}
                                color={statusColor}
                            />
                        </View>
                    </View>
                </View>

                <Text style={styles.title}>{statusTitle}</Text>
                <Text style={styles.description}>{statusDescription}</Text>

                {/* Status card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusTopRow}>
                        <View
                            style={[
                                styles.statusPill,
                                { backgroundColor: statusSoft },
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: statusColor },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusLabel,
                                    { color: statusColor },
                                ]}
                            >
                                {statusLabel}
                            </Text>
                        </View>
                    </View>

                    {checking && !hasChecked ? (
                        <View style={styles.checkingRow}>
                            <ActivityIndicator color={COLORS.blue} />
                            <Text style={styles.checkingText}>
                                Checking your request...
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.statusMessage}>
                            {isApproved
                                ? 'School verification completed'
                                : isRejected
                                    ? 'School review completed'
                                    : 'Waiting for school administrator review'}
                        </Text>
                    )}
                </View>

                {/* Message / error */}
                {message ? (
                    <View
                        style={[styles.messageBox, { backgroundColor: messageSoft }]}
                        accessibilityRole="alert"
                    >
                        <Icon name={messageIcon} size={20} color={messageColor} />
                        <Text style={[styles.messageText, { color: messageColor }]}>
                            {message}
                        </Text>
                    </View>
                ) : null}

                {/* Registration details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Registration details</Text>

                    <View style={styles.detailsCard}>
                        {detailRows.map((row, index) => (
                            <View
                                key={row.label}
                                style={[
                                    styles.detailRow,
                                    index === detailRows.length - 1 &&
                                    styles.lastRow,
                                ]}
                                accessible
                                accessibilityLabel={`${row.label}: ${row.value || 'Not provided'
                                    }`}
                            >
                                <Text style={styles.detailLabel}>{row.label}</Text>
                                <Text style={styles.detailValue}>
                                    {row.value || 'Not provided'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* What happens next */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What happens next?</Text>

                    <View style={styles.timeline}>
                        <View style={styles.timelineItem}>
                            <View style={[styles.timelineIcon, styles.iconDone]}>
                                <Icon name="check" size={16} color={COLORS.white} />
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>
                                    Registration submitted
                                </Text>
                                <Text style={styles.timelineDescription}>
                                    Your request has been sent to the school.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timelineLine} />

                        <View style={styles.timelineItem}>
                            <View
                                style={[
                                    styles.timelineIcon,
                                    styles.iconPending,
                                    isApproved && styles.iconDone,
                                    isRejected && styles.iconRejected,
                                ]}
                            >
                                {isApproved ? (
                                    <Icon name="check" size={16} color={COLORS.white} />
                                ) : isRejected ? (
                                    <Icon name="alert" size={16} color={COLORS.red} />
                                ) : (
                                    <Text style={styles.timelineNumber}>2</Text>
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineTitle}>
                                    School reviews your details
                                </Text>
                                <Text style={styles.timelineDescription}>
                                    The administrator checks the student record and your
                                    submitted information.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.timelineLine} />

                        <View style={styles.timelineItem}>
                            <View
                                style={[
                                    styles.timelineIcon,
                                    styles.iconPending,
                                    isApproved && styles.iconDone,
                                ]}
                            >
                                {isApproved ? (
                                    <Icon name="check" size={16} color={COLORS.white} />
                                ) : (
                                    <Text style={styles.timelineNumber}>3</Text>
                                )}
                            </View>
                            <View style={styles.timelineContent}>
                                <Text
                                    style={[
                                        styles.timelineTitle,
                                        !isApproved && styles.timelineTitleInactive,
                                    ]}
                                >
                                    Parent access activated
                                </Text>
                                <Text style={styles.timelineDescription}>
                                    Once approved, authorised features become available.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {isApproved ? (
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.replace('/(parent)')}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Continue to dashboard"
                    >
                        <Text style={styles.primaryButtonText}>
                            Continue to dashboard
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            checking && styles.buttonDisabled,
                        ]}
                        onPress={checkStatus}
                        disabled={checking}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Check approval status"
                        accessibilityState={{ disabled: checking }}
                    >
                        {checking ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Check approval status
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                <View style={styles.footerRow}>
                    <Icon name="bell" size={16} color={COLORS.muted} />
                    <Text style={styles.footer}>
                        You'll be notified when the school reviews your registration,
                        once notifications are enabled.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 42,
        height: 42,
        borderRadius: 13,
        backgroundColor: COLORS.blue,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontFamily: FONTS.heading,
        fontSize: 22,
        color: COLORS.white,
    },
    brand: {
        fontFamily: FONTS.heading,
        fontSize: 22,
        color: COLORS.charcoal,
        marginLeft: 11,
    },

    // Illustration
    statusIllustration: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    outerCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },

    title: {
        textAlign: 'center',
        fontFamily: FONTS.heading,
        fontSize: 24,
        color: COLORS.charcoal,
        marginBottom: 8,
    },
    description: {
        textAlign: 'center',
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 22,
        color: COLORS.muted,
        marginBottom: 22,
        paddingHorizontal: 8,
    },

    // Status card
    statusCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    statusTopRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusLabel: {
        fontFamily: FONTS.bodyBold,
        fontSize: 13,
    },
    statusMessage: {
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        color: COLORS.charcoal,
    },
    checkingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    checkingText: {
        fontFamily: FONTS.body,
        fontSize: 14,
        color: COLORS.muted,
    },

    // Message
    messageBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    messageText: {
        flex: 1,
        fontFamily: FONTS.bodyMedium,
        fontSize: 14,
        lineHeight: 21,
    },

    // Sections
    section: {
        marginTop: 10,
        marginBottom: 14,
    },
    sectionTitle: {
        fontFamily: FONTS.heading,
        fontSize: 20,
        color: COLORS.charcoal,
        marginBottom: 12,
    },
    detailsCard: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        paddingHorizontal: 16,
    },
    detailRow: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    lastRow: {
        borderBottomWidth: 0,
    },
    detailLabel: {
        fontFamily: FONTS.bodyMedium,
        fontSize: 12,
        color: COLORS.muted,
        marginBottom: 4,
    },
    detailValue: {
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        color: COLORS.charcoal,
    },

    // Timeline (a real sequence, so steps are numbered)
    timeline: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    timelineIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconDone: {
        backgroundColor: COLORS.green,
    },
    iconPending: {
        backgroundColor: COLORS.greySoft,
    },
    iconRejected: {
        backgroundColor: COLORS.redSoft,
    },
    timelineNumber: {
        fontFamily: FONTS.bodyBold,
        fontSize: 13,
        color: COLORS.muted,
    },
    timelineContent: {
        flex: 1,
        marginLeft: 12,
    },
    timelineTitle: {
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
        color: COLORS.charcoal,
        marginBottom: 3,
    },
    timelineTitleInactive: {
        fontFamily: FONTS.bodyMedium,
        color: COLORS.muted,
    },
    timelineDescription: {
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
        color: COLORS.muted,
    },
    timelineLine: {
        height: 22,
        width: 2,
        backgroundColor: COLORS.border,
        marginLeft: 13,
        marginVertical: 4,
    },

    // Button
    primaryButton: {
        minHeight: 52,
        borderRadius: 14,
        backgroundColor: COLORS.blue,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        fontFamily: FONTS.bodyBold,
        fontSize: 16,
        color: COLORS.white,
    },

    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 20,
        paddingHorizontal: 12,
    },
    footer: {
        flexShrink: 1,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
        color: COLORS.muted,
        textAlign: 'center',
    },
});