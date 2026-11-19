import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
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

const RELATIONSHIPS = [
    { label: 'Mother', value: 'mother' },
    { label: 'Father', value: 'father' },
    { label: 'Guardian', value: 'guardian' },
    { label: 'Other', value: 'other' },
];

type SchoolClass = {
    id: string;
    name: string;
    grade_level: string | null;
    academic_year: string;
};

type IconName = 'back' | 'school' | 'info' | 'check' | 'alert' | 'lock';

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
            {name === 'school' && (
                <>
                    <Path d="M2.5 9.5L12 4.5l9.5 5-9.5 5-9.5-5z" {...common} />
                    <Path d="M6.5 12.2v4.3c0 1.2 2.5 2.7 5.5 2.7s5.5-1.5 5.5-2.7v-4.3" {...common} />
                    <Path d="M21.5 9.5v5" {...common} />
                </>
            )}
            {name === 'info' && (
                <>
                    <Circle cx="12" cy="12" r="9" {...common} />
                    <Path d="M12 11v5.5" {...common} />
                    <Path d="M12 7.6v.01" {...common} />
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

function PageHeader({ onBack }: { onBack: () => void }) {
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                activeOpacity={0.7}
            >
                <Icon name="back" size={24} />
            </TouchableOpacity>

            <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Add your child</Text>
                <Text style={styles.headerSubtitle}>Step 3 of 4</Text>
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
            accessibilityLabel="Parent account setup, step 3 of 4"
        >
            <View style={styles.progressActive} />
            <View style={styles.progressActive} />
            <View style={styles.progressActive} />
            <View style={styles.progressInactive} />
        </View>
    );
}

export default function ChildDetailsScreen() {
    const router = useRouter();

    const { schoolId, schoolName, schoolCode } = useLocalSearchParams<{
        schoolId: string;
        schoolName: string;
        schoolCode: string;
    }>();

    const [childName, setChildName] = useState('');
    const [admissionNumber, setAdmissionNumber] = useState('');
    const [relationship, setRelationship] = useState('');

    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);

    const [loadingClasses, setLoadingClasses] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    // Load classes belonging to the selected school.
    useEffect(() => {
        let cancelled = false;

        const loadClasses = async () => {
            if (!schoolId) {
                setMessage(
                    'The selected school could not be identified. Please go back and select your school again.'
                );
                setLoadingClasses(false);
                return;
            }

            setLoadingClasses(true);

            try {
                const { data, error } = await supabase
                    .from('classes')
                    .select('id, name, grade_level, academic_year')
                    .eq('school_id', schoolId)
                    .order('name');

                if (error) {
                    throw error;
                }

                if (!cancelled) {
                    setClasses((data ?? []) as SchoolClass[]);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    setMessage(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load school classes. Please try again.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingClasses(false);
                }
            }
        };

        loadClasses();

        return () => {
            cancelled = true;
        };
    }, [schoolId]);

    const handleContinue = () => {
        setMessage('');

        if (!schoolId || !schoolName) {
            setMessage('School information is missing. Please select your school again.');
            return;
        }

        if (childName.trim().length < 2) {
            setMessage("Please enter your child's full name.");
            return;
        }

        if (!admissionNumber.trim()) {
            setMessage('Please enter the admission or student number.');
            return;
        }

        if (!selectedClass) {
            setMessage("Please select your child's class.");
            return;
        }

        if (!relationship) {
            setMessage('Please select your relationship to the child.');
            return;
        }

        setSubmitting(true);

        router.push({
            pathname: '/(auth)/review_submit',
            params: {
                schoolId,
                schoolName,
                schoolCode: schoolCode ?? '',
                childName: childName.trim(),
                admissionNumber: admissionNumber.trim(),
                classId: selectedClass.id,
                className: selectedClass.name,
                academicYear: selectedClass.academic_year,
                relationship,
            },
        });

        setSubmitting(false);
    };

    const continueDisabled =
        loadingClasses || submitting || classes.length === 0;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <PageHeader onBack={() => router.back()} />

                    <ProgressBar />

                    <Text style={styles.description}>
                        Enter your child's school details. The school will use this
                        information to verify that you are authorised to access
                        their information.
                    </Text>

                    {/* Selected school */}
                    <View style={styles.schoolCard}>
                        <View style={styles.iconCircle}>
                            <Icon name="school" size={22} color={COLORS.blue} />
                        </View>

                        <View style={styles.schoolTextWrap}>
                            <Text style={styles.schoolLabel}>Selected school</Text>
                            <Text style={styles.schoolName}>
                                {schoolName || 'School not selected'}
                            </Text>
                            {!!schoolCode && (
                                <Text style={styles.schoolCode}>
                                    School code: {schoolCode}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Note */}
                    <View style={styles.noteBox}>
                        <View style={styles.noteIcon}>
                            <Icon name="info" size={20} color={COLORS.blue} />
                        </View>
                        <View style={styles.noteTextWrap}>
                            <Text style={styles.noteTitle}>
                                Make sure the details are correct
                            </Text>
                            <Text style={styles.noteText}>
                                Use the child's official name and admission number
                                as recorded by the school.
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Child details</Text>

                    <View style={styles.field}>
                        <Text style={styles.label}>Child's full name</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Enter full name"
                            placeholderTextColor={COLORS.muted}
                            value={childName}
                            onChangeText={(value) => {
                                setChildName(value);
                                setMessage('');
                            }}
                            autoCapitalize="words"
                            accessibilityLabel="Child's full name"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>
                            Admission / Student number
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="e.g. ADM-2026-001"
                            placeholderTextColor={COLORS.muted}
                            value={admissionNumber}
                            onChangeText={(value) => {
                                setAdmissionNumber(value);
                                setMessage('');
                            }}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            accessibilityLabel="Admission or student number"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Class / Grade</Text>

                        {loadingClasses ? (
                            <View style={styles.stateCard}>
                                <ActivityIndicator color={COLORS.blue} />
                                <Text style={styles.stateText}>
                                    Loading classes...
                                </Text>
                            </View>
                        ) : classes.length === 0 ? (
                            <View style={styles.stateCardColumn}>
                                <Text style={styles.emptyTitle}>
                                    No classes available
                                </Text>

                                <Text style={styles.emptyText}>
                                    This school has no classes available for
                                    selection yet. Please contact the school
                                    administrator.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.classList}>
                                {classes.map((item) => {
                                    const selected =
                                        selectedClass?.id === item.id;

                                    return (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[
                                                styles.classOption,
                                                selected &&
                                                styles.classOptionSelected,
                                            ]}
                                            onPress={() => {
                                                setSelectedClass(item);
                                                setMessage('');
                                            }}
                                            activeOpacity={0.8}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={`${item.name}, academic year ${item.academic_year}`}
                                        >
                                            <View style={styles.classDetails}>
                                                <Text style={styles.className}>
                                                    {item.name}
                                                </Text>

                                                <Text style={styles.classYear}>
                                                    {item.grade_level &&
                                                        item.grade_level !== item.name
                                                        ? `${item.grade_level} · `
                                                        : ''}
                                                    Academic year {item.academic_year}
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.radio,
                                                    selected &&
                                                    styles.radioSelected,
                                                ]}
                                            >
                                                {selected && (
                                                    <Icon
                                                        name="check"
                                                        size={14}
                                                        color={COLORS.white}
                                                    />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>
                            Your relationship to the child
                        </Text>

                        <View style={styles.relationshipGrid}>
                            {RELATIONSHIPS.map((item) => {
                                const selected = relationship === item.value;

                                return (
                                    <TouchableOpacity
                                        key={item.value}
                                        style={[
                                            styles.relationshipButton,
                                            selected &&
                                            styles.relationshipSelected,
                                        ]}
                                        onPress={() => {
                                            setRelationship(item.value);
                                            setMessage('');
                                        }}
                                        activeOpacity={0.8}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                        accessibilityLabel={item.label}
                                    >
                                        <Text
                                            style={[
                                                styles.relationshipText,
                                                selected &&
                                                styles.relationshipTextSelected,
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {!!message && (
                        <View
                            style={styles.errorBox}
                            accessibilityRole="alert"
                        >
                            <Icon name="alert" size={20} color={COLORS.red} />
                            <Text style={styles.errorText}>{message}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            continueDisabled && styles.buttonDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={continueDisabled}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Continue"
                        accessibilityState={{ disabled: continueDisabled }}
                    >
                        {submitting ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Continue
                            </Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footerRow}>
                        <Icon name="lock" size={16} color={COLORS.muted} />
                        <Text style={styles.footer}>
                            Your child's information is only shared with
                            authorised school administrators.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    flex: {
        flex: 1,
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

    progressInactive: {
        flex: 1,
        height: 5,
        borderRadius: 5,
        backgroundColor: COLORS.greySoft,
    },

    description: {
        fontFamily: FONTS.body,
        fontSize: 15,
        lineHeight: 23,
        color: COLORS.muted,
        marginBottom: 20,
    },

    // School card
    schoolCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },

    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    schoolTextWrap: {
        flex: 1,
        marginLeft: 14,
    },

    schoolLabel: {
        fontFamily: FONTS.bodyMedium,
        fontSize: 12,
        color: COLORS.muted,
        marginBottom: 2,
    },

    schoolName: {
        fontFamily: FONTS.bodyBold,
        fontSize: 16,
        color: COLORS.charcoal,
    },

    schoolCode: {
        fontFamily: FONTS.body,
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 2,
    },

    // Note
    noteBox: {
        flexDirection: 'row',
        backgroundColor: COLORS.paleBlue,
        borderRadius: 18,
        padding: 16,
        marginBottom: 24,
    },

    noteIcon: {
        marginTop: 1,
    },

    noteTextWrap: {
        flex: 1,
        marginLeft: 12,
    },

    noteTitle: {
        fontFamily: FONTS.bodyBold,
        fontSize: 14,
        color: COLORS.charcoal,
        marginBottom: 4,
    },

    noteText: {
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 20,
        color: COLORS.muted,
    },

    sectionTitle: {
        fontFamily: FONTS.heading,
        fontSize: 20,
        color: COLORS.charcoal,
        marginBottom: 14,
    },

    // Fields
    field: {
        marginBottom: 20,
    },

    label: {
        fontFamily: FONTS.bodyMedium,
        fontSize: 14,
        color: COLORS.charcoal,
        marginBottom: 8,
    },

    input: {
        minHeight: 52,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontFamily: FONTS.body,
        fontSize: 15,
        color: COLORS.charcoal,
        backgroundColor: COLORS.white,
    },

    // Loading / empty states
    stateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLORS.white,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
    },

    stateCardColumn: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
    },

    stateText: {
        fontFamily: FONTS.body,
        fontSize: 14,
        color: COLORS.muted,
    },

    emptyTitle: {
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        color: COLORS.charcoal,
        marginBottom: 4,
    },

    emptyText: {
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 20,
        color: COLORS.muted,
    },

    // Class options
    classList: {
        gap: 10,
    },

    classOption: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 64,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 16,
    },

    classOptionSelected: {
        borderColor: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
    },

    classDetails: {
        flex: 1,
        gap: 3,
    },

    className: {
        fontFamily: FONTS.bodyBold,
        fontSize: 15,
        color: COLORS.charcoal,
    },

    classYear: {
        fontFamily: FONTS.body,
        fontSize: 13,
        color: COLORS.muted,
    },

    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },

    radioSelected: {
        backgroundColor: COLORS.blue,
        borderColor: COLORS.blue,
    },

    // Relationship
    relationshipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },

    relationshipButton: {
        minHeight: 44,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 14,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },

    relationshipSelected: {
        borderColor: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
    },

    relationshipText: {
        fontFamily: FONTS.bodyMedium,
        fontSize: 14,
        color: COLORS.charcoal,
    },

    relationshipTextSelected: {
        fontFamily: FONTS.bodyBold,
        color: COLORS.blue,
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

    // Button
    primaryButton: {
        minHeight: 52,
        backgroundColor: COLORS.blue,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },

    buttonDisabled: {
        opacity: 0.5,
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