
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ClassroomViewingScreen() {
    const router = useRouter();
    const { cameraId } = useLocalSearchParams<{ cameraId: string }>();

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.back}>← Back to monitoring</Text>
                </Pressable>

                <Text style={styles.title}>Classroom viewing</Text>
                <Text style={styles.subtitle}>
                    Authorized classroom camera
                </Text>

                {/* Video player area */}
                <View style={styles.player}>
                    <Text style={styles.cameraIcon}>◉</Text>
                    <Text style={styles.playerTitle}>Stream unavailable</Text>
                    <Text style={styles.playerDescription}>
                        A secure video stream has not been connected yet.
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <Text style={styles.label}>Camera reference</Text>
                    <Text style={styles.value}>
                        {cameraId || 'Not provided'}
                    </Text>

                    <View style={styles.divider} />

                    <Text style={styles.label}>Connection status</Text>
                    <Text style={styles.offline}>Not connected</Text>

                    <View style={styles.divider} />

                    <Text style={styles.label}>Access</Text>
                    <Text style={styles.value}>
                        Must be verified by the school
                    </Text>
                </View>

                <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>Privacy and security</Text>
                    <Text style={styles.noticeText}>
                        Classroom viewing will require a valid authorization
                        from the backend. Camera streams must not be accessible
                        through public URLs.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F7F6F0',
    },
    container: {
        padding: 20,
        paddingBottom: 30,
    },
    back: {
        color: '#2563EB',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 25,
    },
    title: {
        color: '#111111',
        fontSize: 25,
        fontWeight: '800',
    },
    subtitle: {
        color: '#777777',
        fontSize: 13,
        marginTop: 7,
        marginBottom: 22,
    },
    player: {
        backgroundColor: '#111111',
        aspectRatio: 16 / 10,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 25,
    },
    cameraIcon: {
        color: '#FFFFFF',
        fontSize: 42,
        marginBottom: 15,
    },
    playerTitle: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 17,
    },
    playerDescription: {
        color: '#D0D0D0',
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 19,
        marginTop: 8,
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 18,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    label: {
        color: '#777777',
        fontSize: 11,
        marginBottom: 6,
    },
    value: {
        color: '#111111',
        fontSize: 14,
        fontWeight: '600',
    },
    offline: {
        color: '#777777',
        fontSize: 13,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#E8E8E8',
        marginVertical: 14,
    },
    notice: {
        backgroundColor: '#E8EEFF',
        borderRadius: 14,
        padding: 16,
        marginTop: 20,
    },
    noticeTitle: {
        color: '#111111',
        fontSize: 14,
        fontWeight: '800',
    },
    noticeText: {
        color: '#424242',
        fontSize: 12,
        lineHeight: 19,
        marginTop: 7,
    },
});
