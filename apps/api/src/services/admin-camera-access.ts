
import { supabaseAdmin } from '../lib/supabase.js';

export interface AdminCameraPlaybackAccess {
    cameraId: string;
    schoolId: string;
    adminId: string;
    streamPath: string;
}

export async function getAdminCameraPlaybackAccess(
    adminId: string,
    cameraId: string,
): Promise<AdminCameraPlaybackAccess | null> {
    // 1. Find the camera and its school.
    const { data: camera, error: cameraError } = await supabaseAdmin
        .from('cameras')
        .select('id, school_id, status, is_enabled')
        .eq('id', cameraId)
        .maybeSingle();

    if (cameraError || !camera) {
        return null;
    }

    if (!camera.is_enabled || camera.status !== 'online') {
        return null;
    }

    // 2. Verify the user is a school administrator for this exact school.
    const { data: membership, error: membershipError } =
        await supabaseAdmin
            .from('school_memberships')
            .select('id')
            .eq('user_id', adminId)
            .eq('school_id', camera.school_id)
            .eq('role', 'school_admin')
            .maybeSingle();

    if (membershipError || !membership) {
        return null;
    }

    // 3. Verify that the school currently permits live viewing.
    const { data: settings, error: settingsError } =
        await supabaseAdmin
            .from('school_settings')
            .select('live_viewing_enabled')
            .eq('school_id', camera.school_id)
            .maybeSingle();

    if (
        settingsError ||
        !settings ||
        !settings.live_viewing_enabled
    ) {
        return null;
    }

    // 4. Verify the camera's actual streaming configuration.
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
        stream.status !== 'online' ||
        !stream.stream_path
    ) {
        return null;
    }

    return {
        cameraId: camera.id,
        schoolId: camera.school_id,
        adminId,
        streamPath: stream.stream_path,
    };
}
