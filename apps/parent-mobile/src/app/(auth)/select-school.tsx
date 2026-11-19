import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ScrollView,
    ActivityIndicator,
    ImageBackground,
    Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

type ScrollViewRef = React.ComponentRef<typeof ScrollView>;

type School = {
    id: string;
    name: string;
    school_code: string;
    county: string | null;
    address: string | null;
    logo_url: string | null;
};

type IconName = 'info' | 'search' | 'hash' | 'check';

function Icon({
    name,
    size = 20,
    color = COLORS.muted,
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
            {name === 'info' && (
                <>
                    <Circle cx={12} cy={12} r={9} {...common} />
                    <Path d="M12 11v5" {...common} />
                    <Path d="M12 8h.01" {...common} />
                </>
            )}
            {name === 'search' && (
                <>
                    <Circle cx={11} cy={11} r={7} {...common} />
                    <Path d="M21 21l-4.3-4.3" {...common} />
                </>
            )}
            {name === 'hash' && (
                <>
                    <Path d="M5 9h14" {...common} />
                    <Path d="M5 15h14" {...common} />
                    <Path d="M10 4L8 20" {...common} />
                    <Path d="M16 4l-2 16" {...common} />
                </>
            )}
            {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...common} />}
        </Svg>
    );
}

export default function SelectSchoolScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [search, setSearch] = useState('');
    const [schoolCode, setSchoolCode] = useState('');
    const [mode, setMode] = useState<'search' | 'code'>('search');

    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // UI-only state: keyboard handling and input focus styling.
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [inputFocused, setInputFocused] = useState(false);
    const scrollRef = useRef<ScrollViewRef>(null);
    const sheetY = useRef(0);
    const inputY = useRef(0);

    const scrollInputIntoView = () => {
        scrollRef.current?.scrollTo({
            y: Math.max(0, sheetY.current + inputY.current - 90),
            animated: true,
        });
    };

    useEffect(() => {
        const showEvent =
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent =
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event.endCoordinates.height);
            setTimeout(scrollInputIntoView, 120);
        });

        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Search active registered schools.
    useEffect(() => {
        let cancelled = false;

        const searchValue =
            mode === 'search' ? search.trim() : schoolCode.trim().toUpperCase();

        setSelectedSchool(null);
        setMessage('');

        if (searchValue.length < 2) {
            setSchools([]);
            setLoading(false);
            return;
        }

        const timeout = setTimeout(async () => {
            setLoading(true);

            try {
                let query = supabase
                    .from('schools')
                    .select(
                        'id, name, school_code, county, address, logo_url'
                    )
                    .eq('status', 'active')
                    .order('name')
                    .limit(20);

                if (mode === 'search') {
                    query = query.ilike('name', `%${searchValue}%`);
                } else {
                    query = query.eq('school_code', searchValue);
                }

                const { data, error } = await query;

                if (error) {
                    throw error;
                }

                if (!cancelled) {
                    setSchools((data ?? []) as School[]);
                }
            } catch (error: unknown) {
                if (!cancelled) {
                    setSchools([]);
                    setMessage(
                        error instanceof Error
                            ? error.message
                            : 'Unable to search schools. Please try again.'
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [search, schoolCode, mode]);

    const handleContinue = () => {
        setMessage('');

        if (!selectedSchool) {
            setMessage('Please select your child’s school to continue.');
            return;
        }

        router.push({
            pathname: '/(auth)/child_details',
            params: {
                schoolId: selectedSchool.id,
                schoolName: selectedSchool.name,
                schoolCode: selectedSchool.school_code,
            },
        });
    };

    const changeMode = (newMode: 'search' | 'code') => {
        setMode(newMode);
        setSearch('');
        setSchoolCode('');
        setSchools([]);
        setSelectedSchool(null);
        setMessage('');
    };

    const keyboardOpen = keyboardHeight > 0;

    return (
        <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: keyboardHeight },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
        >
            {/* Photo header */}
            <ImageBackground
                source={require('@/assets/images/schoolview-auth-background.jpg')}
                style={[styles.hero, { paddingTop: insets.top + 16 }]}
                resizeMode="cover"
            >
                <View style={styles.heroOverlay} />

                <Text style={styles.brandName}>SchoolView</Text>
            </ImageBackground>

            {/* Content sheet */}
            <View
                style={[
                    styles.sheet,
                    { paddingBottom: Math.max(insets.bottom, 16) + 10 },
                ]}
                onLayout={(event) => {
                    sheetY.current = event.nativeEvent.layout.y;
                }}
            >
                <View
                    style={styles.progressRow}
                    accessible
                    accessibilityLabel="Step 2 of 4"
                >
                    <View style={styles.progressActive} />
                    <View style={styles.progressActive} />
                    <View style={styles.progressInactive} />
                    <View style={styles.progressInactive} />
                </View>

                <View style={styles.heading}>
                    <Text style={styles.step}>
                        PARENT ACCOUNT · STEP 2 OF 4
                    </Text>

                    <Text style={styles.title}>Find your school</Text>

                    <Text style={styles.description}>
                        Select the school your child attends so we can connect
                        your account to the correct school community.
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoIcon}>
                        <Icon name="info" size={18} color={COLORS.blue} />
                    </View>

                    <View style={styles.infoBody}>
                        <Text style={styles.infoTitle}>
                            Why do we need this?
                        </Text>

                        <Text style={styles.infoText}>
                            Your school will verify your child's details before
                            granting access to classroom monitoring and school
                            updates.
                        </Text>
                    </View>
                </View>

                <View style={styles.modeRow}>
                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            mode === 'search' && styles.modeButtonActive,
                        ]}
                        onPress={() => changeMode('search')}
                        accessibilityRole="button"
                        accessibilityLabel="Search school"
                        accessibilityState={{ selected: mode === 'search' }}
                    >
                        <Text
                            style={[
                                styles.modeText,
                                mode === 'search' && styles.modeTextActive,
                            ]}
                        >
                            Search school
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.modeButton,
                            mode === 'code' && styles.modeButtonActive,
                        ]}
                        onPress={() => changeMode('code')}
                        accessibilityRole="button"
                        accessibilityLabel="Use school code"
                        accessibilityState={{ selected: mode === 'code' }}
                    >
                        <Text
                            style={[
                                styles.modeText,
                                mode === 'code' && styles.modeTextActive,
                            ]}
                        >
                            Use school code
                        </Text>
                    </TouchableOpacity>
                </View>

                <View
                    style={styles.inputBlock}
                    onLayout={(event) => {
                        inputY.current = event.nativeEvent.layout.y;
                    }}
                >
                    <View
                        style={[
                            styles.inputWrap,
                            inputFocused && styles.inputFocused,
                        ]}
                    >
                        <Icon
                            name={mode === 'search' ? 'search' : 'hash'}
                            color={inputFocused ? COLORS.blue : COLORS.muted}
                        />

                        {mode === 'search' ? (
                            <TextInput
                                style={styles.input}
                                placeholder="Search school name..."
                                placeholderTextColor="#9CA3AF"
                                value={search}
                                onChangeText={setSearch}
                                autoCapitalize="words"
                                autoCorrect={false}
                                returnKeyType="search"
                                onFocus={() => {
                                    setInputFocused(true);
                                    setTimeout(scrollInputIntoView, 120);
                                }}
                                onBlur={() => setInputFocused(false)}
                                accessibilityLabel="Search school name"
                            />
                        ) : (
                            <TextInput
                                style={styles.input}
                                placeholder="Enter unique school code"
                                placeholderTextColor="#9CA3AF"
                                value={schoolCode}
                                onChangeText={setSchoolCode}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                onFocus={() => {
                                    setInputFocused(true);
                                    setTimeout(scrollInputIntoView, 120);
                                }}
                                onBlur={() => setInputFocused(false)}
                                accessibilityLabel="School code"
                            />
                        )}
                    </View>

                    <Text style={styles.helper}>
                        {mode === 'search'
                            ? 'Search for the registered school your child attends.'
                            : 'Ask your school administrator for its registration code.'}
                    </Text>
                </View>

                {loading && (
                    <View style={styles.stateCard}>
                        <ActivityIndicator color={COLORS.blue} />
                        <Text style={styles.stateText}>
                            Finding schools...
                        </Text>
                    </View>
                )}

                {!loading && schools.length > 0 && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.resultsHeading}>
                            AVAILABLE SCHOOLS
                        </Text>

                        {schools.map((school) => {
                            const isSelected = selectedSchool?.id === school.id;
                            const location =
                                [school.address, school.county]
                                    .filter(Boolean)
                                    .join(', ') ||
                                `School code: ${school.school_code}`;

                            return (
                                <TouchableOpacity
                                    key={school.id}
                                    style={[
                                        styles.schoolCard,
                                        isSelected && styles.schoolCardSelected,
                                    ]}
                                    onPress={() => {
                                        setSelectedSchool(school);
                                        setMessage('');
                                    }}
                                    activeOpacity={0.8}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: isSelected }}
                                    accessibilityLabel={`${school.name}, ${location}`}
                                >
                                    <View style={styles.schoolIcon}>
                                        <Text style={styles.schoolIconText}>
                                            {school.name
                                                .charAt(0)
                                                .toUpperCase()}
                                        </Text>
                                    </View>

                                    <View style={styles.schoolDetails}>
                                        <Text style={styles.schoolName}>
                                            {school.name}
                                        </Text>

                                        <Text style={styles.schoolLocation}>
                                            {location}
                                        </Text>
                                    </View>

                                    <View
                                        style={[
                                            styles.radio,
                                            isSelected && styles.radioSelected,
                                        ]}
                                    >
                                        {isSelected && (
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

                {!loading &&
                    (mode === 'search'
                        ? search.trim().length >= 2
                        : schoolCode.trim().length >= 2) &&
                    schools.length === 0 &&
                    !message && (
                        <View style={styles.stateCard}>
                            <Text style={styles.emptyTitle}>
                                No schools found
                            </Text>

                            <Text style={styles.emptyText}>
                                Check the spelling or school code and try
                                again. Your school must be registered and active
                                on SchoolView.
                            </Text>
                        </View>
                    )}

                {!!message && (
                    <View style={styles.messageBox} accessibilityRole="alert">
                        <Text style={styles.error}>{message}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        (!selectedSchool || loading) && styles.buttonDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={!selectedSchool || loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Continue"
                    accessibilityState={{ disabled: !selectedSchool || loading }}
                >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Text style={styles.backText}>Go back</Text>
                </TouchableOpacity>

                {!keyboardOpen && (
                    <Text style={styles.footer}>
                        SchoolView · Connecting schools and families
                    </Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: COLORS.white,
    },

    scrollContent: {
        flexGrow: 1,
    },

    hero: {
        paddingHorizontal: 24,
        paddingBottom: 100,
        overflow: 'hidden',
    },

    heroOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(22, 131, 197, 0.38)',
    },

    brandName: {
        color: COLORS.white,
        fontSize: 26,
        fontFamily: FONTS.heading,
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },

    sheet: {
        flexGrow: 1,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: -28,
        paddingHorizontal: 22,
        paddingTop: 24,
        gap: 16,
    },

    progressRow: {
        flexDirection: 'row',
        gap: 7,
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
        backgroundColor: COLORS.border,
    },

    heading: {
        gap: 2,
    },

    step: {
        color: COLORS.blue,
        fontSize: 12,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 1.4,
    },

    title: {
        color: COLORS.charcoal,
        fontSize: 28,
        fontFamily: FONTS.heading,
    },

    description: {
        color: COLORS.muted,
        fontSize: 14,
        lineHeight: 21,
        fontFamily: FONTS.serif,
        marginTop: 2,
    },

    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.paleBlue,
        borderRadius: 14,
        padding: 14,
    },

    infoIcon: {
        marginRight: 10,
        marginTop: 1,
    },

    infoBody: {
        flex: 1,
    },

    infoTitle: {
        color: COLORS.charcoal,
        fontSize: 14,
        fontFamily: FONTS.bodyBold,
    },

    infoText: {
        color: COLORS.charcoal,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: FONTS.body,
        marginTop: 3,
    },

    modeRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.greySoft,
        borderRadius: 14,
        padding: 4,
    },

    modeButton: {
        flex: 1,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 11,
        borderWidth: 1,
        borderColor: 'transparent',
    },

    modeButtonActive: {
        backgroundColor: COLORS.white,
        borderColor: COLORS.border,
    },

    modeText: {
        fontSize: 14,
        color: COLORS.muted,
        fontFamily: FONTS.bodyMedium,
    },

    modeTextActive: {
        color: COLORS.blue,
        fontFamily: FONTS.bodyBold,
    },

    inputBlock: {
        gap: 8,
    },

    inputWrap: {
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        gap: 10,
    },

    inputFocused: {
        borderColor: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
    },

    input: {
        flex: 1,
        height: 52,
        color: COLORS.charcoal,
        fontSize: 15,
        fontFamily: FONTS.bodyMedium,
        paddingVertical: 0,
    },

    helper: {
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.body,
    },

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

    stateText: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.bodyMedium,
    },

    resultsContainer: {
        gap: 10,
    },

    resultsHeading: {
        color: COLORS.muted,
        fontSize: 12,
        fontFamily: FONTS.bodyBold,
        letterSpacing: 1.2,
    },

    schoolCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 18,
        padding: 14,
        gap: 12,
        minHeight: 72,
    },

    schoolCardSelected: {
        borderColor: COLORS.blue,
        backgroundColor: COLORS.paleBlue,
    },

    schoolIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.paleBlue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    schoolIconText: {
        color: COLORS.blue,
        fontSize: 18,
        fontFamily: FONTS.heading,
    },

    schoolDetails: {
        flex: 1,
        gap: 3,
    },

    schoolName: {
        color: COLORS.charcoal,
        fontSize: 15,
        fontFamily: FONTS.bodyBold,
    },

    schoolLocation: {
        color: COLORS.muted,
        fontSize: 12.5,
        fontFamily: FONTS.body,
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
    },

    radioSelected: {
        backgroundColor: COLORS.blue,
        borderColor: COLORS.blue,
    },

    emptyTitle: {
        color: COLORS.charcoal,
        fontSize: 15,
        fontFamily: FONTS.bodyBold,
        marginBottom: 4,
    },

    emptyText: {
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.body,
    },

    messageBox: {
        backgroundColor: COLORS.redSoft,
        borderRadius: 12,
        padding: 12,
    },

    error: {
        color: COLORS.red,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: FONTS.bodyMedium,
    },

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
        color: COLORS.white,
        fontSize: 16,
        fontFamily: FONTS.bodyBold,
    },

    backButton: {
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.blue,
        alignItems: 'center',
        justifyContent: 'center',
    },

    backText: {
        color: COLORS.blue,
        fontSize: 15,
        fontFamily: FONTS.bodyBold,
    },

    footer: {
        color: COLORS.muted,
        fontSize: 12,
        fontFamily: FONTS.body,
        textAlign: 'center',
        opacity: 0.8,
    },
});