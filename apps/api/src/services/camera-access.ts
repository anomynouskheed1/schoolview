
import { supabaseAdmin } from '../lib/supabase.js';

export interface CameraPlaybackAccess {
    cameraId: string;
    schoolId: string;
    parentStudentId: string;
    cameraAccessId: string;
    streamPath: string;
    grantExpiresAt: string | null;
}

export async function getCameraPlaybackAccess(
    parentId: string,
    cameraId: string,
    parentStudentId: string,
): Promise<CameraPlaybackAccess | null> {
    // 1. Find the requested camera.
    const { data: camera, error: cameraError } = await supabaseAdmin
        .from('cameras')
        .select('id, school_id, class_id, status, is_enabled')
        .eq('id', cameraId)
        .maybeSingle();

    if (cameraError || !camera) {
        return null;
    }

    if (!camera.is_enabled || camera.status !== 'online') {
        return null;
    }

    // 2. Check that this exact relationship belongs to this parent.
    const { data: relationship, error: relationshipError } =
        await supabaseAdmin
            .from('parent_students')
            .select('id, student_id, school_id, status')
            .eq('id', parentStudentId)
            .eq('parent_id', parentId)
            .eq('school_id', camera.school_id)
            .eq('status', 'approved')
            .maybeSingle();

    if (relationshipError || !relationship) {
        return null;
    }

    // 3. Verify that the camera belongs to the selected child's class.
    const { data: student, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, class_id')
        .eq('id', relationship.student_id)
        .maybeSingle();

    if (studentError || !student) {
        return null;
    }

    if (
        camera.class_id &&
        student.class_id !== camera.class_id
    ) {
        return null;
    }

    // 4. Check the school's live-viewing setting.
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('school_settings')
        .select('live_viewing_enabled')
        .eq('school_id', camera.school_id)
        .maybeSingle();

    // Fail closed if the setting cannot be verified.
    if (
        settingsError ||
        !settings ||
        !settings.live_viewing_enabled
    ) {
        return null;
    }

    // 5. Find the grant for this exact parent-child relationship.
    const { data: grants, error: grantError } = await supabaseAdmin
        .from('camera_access')
        .select('id, expires_at, revoked_at')
        .eq('camera_id', camera.id)
        .eq('school_id', camera.school_id)
        .eq('parent_student_id', relationship.id)
        .is('revoked_at', null);

    if (grantError || !grants?.length) {
        return null;
    }

    const now = Date.now();

    const activeGrant = grants.find((grant) => {
        if (!grant.expires_at) {
            return true;
        }

        return new Date(grant.expires_at).getTime() > now;
    });

    if (!activeGrant) {
        return null;
    }

    // 6. Find the corresponding MediaMTX stream configuration.
    const { data: stream, error: streamError } = await supabaseAdmin
        .from('camera_stream_configs')
        .select('stream_path, status, is_enabled')
        .eq('camera_id', camera.id)
        .eq('school_id', camera.school_id)
        .maybeSingle();

    if (
        streamError ||
        !stream ||
        !stream.is_enabled ||
        stream.status !== 'online'
    ) {
        return null;
    }

    return {
        cameraId: camera.id,
        schoolId: camera.school_id,
        parentStudentId: relationship.id,
        cameraAccessId: activeGrant.id,
        streamPath: stream.stream_path,
        grantExpiresAt: activeGrant.expires_at,
    };
}
