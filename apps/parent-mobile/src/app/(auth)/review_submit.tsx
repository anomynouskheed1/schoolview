import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
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

type SubmissionResult = {
    success: boolean;
    already_exists: boolean;
    status: string;
    message: string;
};

type IconName = 'back' | 'check' | 'alert' | 'lock' | 'shield';

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
            {name === 'back' && <Path d="M15 5l-7 7 7 7" {...common} />}
            {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...common} />}
            {name === 'shield' && (
                <>
                    <Path d="M12 3l7.5 3v5.5c0 4.5-3.1 8-7.5 9.5-4.4-1.5-7.5-5-7.5-9.5V6L12 3z" {...common} />
                    <Path d="M8.8 12l2.2 2.2 4.2-4.4" {...common} />
                </>
            )}
            {name === 'alert' && (
                <>
                    <Circle cx="12" cy="12" r="9" {...common} />
                    <Path d="M12 7.5v5" {...common} />
                    <Path d="M12 16.2v.01" {...common} />
                </>
            )}
            {name === 'lock' && (
                <>
                    <Path d="M6 11h12a1.5 1.5 0 011.5 1.5v6A1.5 1.5 0 0118 20H6a1.5 1.5 0 01-1.5-1.5v-6A1.5 1.5 0 016 11z" {...common} />
                    <Path d="M8 11V8a4 4 0 018 0v3" {...common} />
                </>
            )}
        </Svg>
    );
}

function PageHeader({
    onBack,
    disabled,
}: {
    onBack: () => void;
    disabled?: boolean;
}) {
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={[styles.backButton, disabled && styles.dimmed]}
                onPress={onBack}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                activeOpacity={0.7}
            >
                <Icon name="back" size={24} />
            </TouchableOpacity>

            <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Review your details</Text>
                <Text style={styles.headerSubtitle}>Step 4 of 4</Text>
            </View>

            <View style={styles.logo} accessibilityLabel="SchoolView">
                <Text style={styles.logoText}>S</Text>
            </View>
        </View>
    );
}

function ProgressBar() {
    return (
        <View
            style={styles.progressRow}
            accessibilityRole="progressbar"
            accessibilityLabel="Parent account setup, step 4 of 4"
        >
            <View style={styles.progressActive} />
            <View style={styles.progressActive} />
            <View style={styles.progressActive} />
            <View style={styles.progressActive} />
        </View>
    );
}

// Display-only: relationship is stored as a lowercase value (e.g. "mother").
function formatValue(label: string, value?: string) {
    if (!value) return 'Not provided';
    if (label === 'Relationship') {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
}

export default function ReviewSubmitScreen() {
    const router = useRouter();

    const params = useLocalSearchParams<{
        schoolId?: string;
        schoolName?: string;
        schoolCode?: string;
        classId?: string;
        childName?: string;
        admissionNumber?: string;
        className?: string;
        academicYear?: string;
        relationship?: string;
    }>();

    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const details = [
        { label: 'School', value: params.schoolName || params.schoolCode },
        { label: "Child's full name", value: params.childName },
        { label: 'Admission number', value: params.admissionNumber },
        { label: 'Class / Grade', value: params.className },
        { label: 'Academic year', value: params.academicYear },
        { label: 'Relationship', value: params.relationship },
    ];

    const hasDetails =
        !!params.schoolId &&
        !!params.classId &&
        details.every(
            (item) =>
                typeof item.value === 'string' &&
                item.value.trim().length > 0
        );

    const handleSubmit = async () => {
        if (submitting) return;

        setMessage('');

        if (!hasDetails) {
            setMessage(
                'Some registration details are missing. Please go back and complete the previous steps.'
            );
            return;
        }

        if (!confirmed) {
            setMessage(
                'Please confirm that the information provided is accurate.'
            );
            return;
        }

        setSubmitting(true);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error(
                    'Your session has expired. Please log in again.'
                );
            }

            const { data, error } = await supabase.rpc(
                'submit_parent_child_request',
                {
                    target_school_id: params.schoolId,
                    target_class_id: params.classId,
                    child_full_name: params.childName?.trim(),
                    child_admission_number: params.admissionNumber?.trim(),
                    parent_relationship: params.relationship,
                }
            );

            if (error) {
                throw error;
            }

            const result = data as SubmissionResult;

            if (!result?.success) {
                throw new Error(
                    result?.message || 'Your request could not be submitted.'
                );
            }

            // Existing approved relationship: open the parent dashboard.
            if (result.status === 'approved') {
                router.replace('/(parent)');
                return;
            }

            // Existing rejected relationship: do not pretend it is pending.
            if (result.status === 'rejected') {
                setMessage(
                    'A previous request for this child was rejected. Please contact the school administrator for assistance.'
                );
                return;
            }

            // New or existing pending request.
            router.replace({
                pathname: '/(auth)/pending_approval',
                params: {
                    schoolId: params.schoolId,
                    schoolName: params.schoolName,
                    childName: params.childName,
                    admissionNumber: params.admissionNumber,
                },
            });
        } catch (error: unknown) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Something went wrong. Please try again.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
            >
                <PageHeader onBack={() => router.back()} disabled={submitting} />

                <ProgressBar />

                <Text style={styles.description}>
                    Please check that everything is correct before sending your
                    registration request to the school.
                </Text>

                {/* Review note */}
                <View style={styles.noteBox}>
                    <View style={styles.noteIcon}>
                        <Icon name="check" size={20} color={COLORS.white} />
                    </View>
                    <View style={styles.noteContent}>
                        <Text style={styles.noteTitle}>Almost there!</Text>
                        <Text style={styles.noteText}>
                            Your details will be reviewed by the school's
                            administration before access is granted.
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Registration summary</Text>
                    <Text style={styles.sectionSubtitle}>
                        Please verify each detail
                    </Text>
                </View>

                <View style={styles.detailsCard}>
                    {details.map((item, index) => (
                        <View
                            key={item.label}
                            style={[
                                styles.detailRow,
                                index === details.length - 1 &&
                                styles.lastDetailRow,
                            ]}
                            accessible
                            accessibilityLabel={`${item.label}: ${formatValue(
                                item.label,
                                item.value
                            )}`}
                        >
                            <Text style={styles.detailLabel}>{item.label}</Text>
                            <Text
                                style={[
                                    styles.detailValue,
                                    !item.value && styles.missingValue,
                                ]}
                            >
                                {formatValue(item.label, item.value)}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.editNote}>
                    <Text style={styles.editNoteText}>
                        Need to correct something? Go back to the previous steps
                        to update your information.
                    </Text>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.back()}
                        disabled={submitting}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Go back and edit"
                    >
                        <Text style={styles.secondaryButtonText}>
                            Go back and edit
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.checkboxRow}
                    activeOpacity={0.8}
                    disabled={submitting}
                    onPress={() => {
                        setConfirmed(!confirmed);
                        setMessage('');
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: confirmed }}
                    accessibilityLabel="I confirm that the information provided is accurate and belongs to the child I am registering"
                >
                    <View
                        style={[
                            styles.checkbox,
                            confirmed && styles.checkboxChecked,
                        ]}
                    >
                        {confirmed ? (
                            <Icon name="check" size={15} color={COLORS.white} />
                        ) : null}
                    </View>

                    <Text style={styles.checkboxText}>
                        I confirm that the information provided is accurate and
                        belongs to the child I am registering.
                    </Text>
                </TouchableOpacity>

                {message ? (
                    <View style={styles.errorBox} accessibilityRole="alert">
                        <Icon name="alert" size={20} color={COLORS.red} />
                        <Text style={styles.errorText}>{message}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Submit registration request"
                    accessibilityState={{ disabled: submitting }}
                >
                    {submitting ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <Text style={styles.submitButtonText}>
                            Submit registration request
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={styles.footerRow}>
                    <Icon name="lock" size={16} color={COLORS.muted} />
                    <Text style={styles.footer}>
                        Your child's information will only be accessible to
                        authorised school personnel.
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
        marginBottom: 18,
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
    },
    dimmed: {
        opacity: 0.5,
    },
    headerText: {
        flex: 1,
        marginLeft: 14,
    },
    headerTitle: {
        fontFamily: FONTS.heading,
        fontSize: 24,
        color: COLORS.charcoal,
    },
    headerSubtitle: {
        fontFamily: FONTS.serif,
        fontSize: 14,
        color: COLORS.muted,
        marginTop: 1,
    },
    logo: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.blue,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontFamily: FONTS.heading,
        fontSize: 20,
        color: COLORS.white,
    },

    // Progress
    progressRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 20,
    },
    progressActive: {
        flex: 1,
        height: 5,
        borderRadius: 5,
        backgroundColor: COLORS.blue,
    },

    description: {
        fontFamily: FONTS.body,
        fontSize: 15,
        lineHeight: 23,
        color: COLORS.muted,
        marginBottom: 20,
    },

    // Note
    noteBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.paleBlue,
        borderRadius: 18,
        padding: 16,
        marginBottom: 24,
    },
    noteIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.blue,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noteContent: {
        flex: 1,
        marginLeft: 12,
    },
    noteTitle: {
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        color: COLORS.charcoal,
        marginBottom: 3,
    },
    noteText: {
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 19,
        color: COLORS.muted,
    },

    // Summary
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontFamily: FONTS.heading,
        fontSize: 20,
        color: COLORS.charcoal,
    },
    sectionSubtitle: {
        fontFamily: FONTS.serif,
        fontSize: 14,
        color: COLORS.muted,
        marginTop: 2,
    },
    detailsCard: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    detailRow: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    lastDetailRow: {
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
    missingValue: {
        fontFamily: FONTS.bodyMedium,
        color: COLORS.red,
    },

    // Edit note
    editNote: {
        marginTop: 16,
        marginBottom: 20,
    },
    editNoteText: {
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 20,
        color: COLORS.muted,
        marginBottom: 10,
    },
    secondaryButton: {
        minHeight: 48,
        borderWidth: 1.5,
        borderColor: COLORS.blue,
        borderRadius: 14,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        color: COLORS.blue,
    },

    // Confirm
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        minHeight: 44,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
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
        marginRight: 12,
        marginTop: 1,
    },
    checkboxChecked: {
        backgroundColor: COLORS.blue,
        borderColor: COLORS.blue,
    },
    checkboxText: {
        flex: 1,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 21,
        color: COLORS.charcoal,
    },

    // Error
    errorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: COLORS.redSoft,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    errorText: {
        flex: 1,
        fontFamily: FONTS.bodyMedium,
        fontSize: 14,
        lineHeight: 21,
        color: COLORS.red,
    },

    // Submit
    submitButton: {
        minHeight: 52,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
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