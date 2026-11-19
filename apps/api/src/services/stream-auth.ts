
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { getCameraPlaybackAccess } from './camera-access.js';
import { getAdminCameraPlaybackAccess } from './admin-camera-access.js';

const authPayloadSchema = z.object({
    user: z.string().default(''),
    password: z.string().default(''),
    token: z.string().default(''),
    ip: z.string().default(''),
    action: z.enum(['publish', 'read', 'playback', 'api', 'metrics', 'pprof']),
    path: z.string().default(''),
    protocol: z.string().default(''),
    id: z.string().default(''),
    query: z.string().default(''),
    userAgent: z.string().default(''),
});

export type MediaMTXAuthPayload = z.infer<typeof authPayloadSchema>;

export interface StreamAuthResult {
    allowed: boolean;
    expireAt?: string;
}

function safeEqual(value: string, expected: string): boolean {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);

    if (valueBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(valueBuffer, expectedBuffer);
}

function deny(
    reason: string,
    payload: MediaMTXAuthPayload,
    detail?: string,
): StreamAuthResult {
    console.warn(
        `[stream-auth] DENIED reason=${reason} action=${payload.action} ` +
        `path=${payload.path || '-'} protocol=${payload.protocol || '-'}` +
        (detail ? ` detail=${detail}` : ''),
    );

    return { allowed: false };
}

async function authorizeParentSession(
    tokenHash: string,
    payload: MediaMTXAuthPayload,
): Promise<StreamAuthResult | null> {
    const { data: session, error: sessionError } = await supabaseAdmin
        .from('camera_playback_sessions')
        .select(
            'id, parent_id, camera_id, parent_student_id, camera_access_id, school_id, expires_at, status',
        )
        .eq('token_hash', tokenHash)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (sessionError) {
        return deny('parent_session_query_error', payload, sessionError.message);
    }

    if (!session) {
        return null;
    }

    if (!session.parent_student_id) {
        return deny('session_missing_parent_student', payload);
    }

    const { data: stream, error: streamError } = await supabaseAdmin
        .from('camera_stream_configs')
        .select('stream_path')
        .eq('camera_id', session.camera_id)
        .eq('school_id', session.school_id)
        .maybeSingle();

    if (streamError) {
        return deny('parent_stream_config_query_error', payload, streamError.message);
    }

    if (!stream) {
        return deny('parent_stream_config_missing', payload);
    }

    if (stream.stream_path !== payload.path) {
        return deny(
            'parent_path_mismatch',
            payload,
            `expected=${stream.stream_path} got=${payload.path}`,
        );
    }

    const currentAccess = await getCameraPlaybackAccess(
        session.parent_id,
        session.camera_id,
        session.parent_student_id,
    );

    if (!currentAccess) {
        return deny(
            'parent_access_check_failed',
            payload,
            'getCameraPlaybackAccess returned null',
        );
    }

    if (
        currentAccess.cameraAccessId !== session.camera_access_id ||
        currentAccess.parentStudentId !== session.parent_student_id ||
        currentAccess.streamPath !== payload.path ||
        currentAccess.schoolId !== session.school_id
    ) {
        return deny('parent_access_mismatch', payload);
    }

    const sessionExpiry = new Date(session.expires_at).getTime();

    const grantExpiry = currentAccess.grantExpiresAt
        ? new Date(currentAccess.grantExpiresAt).getTime()
        : Number.POSITIVE_INFINITY;

    const expiry = Math.min(sessionExpiry, grantExpiry);

    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
        return deny('parent_session_expired', payload);
    }

    const { error: activityError } = await supabaseAdmin
        .from('camera_playback_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('status', 'active');

    if (activityError) {
        return deny('parent_activity_update_failed', payload, activityError.message);
    }

    console.log(`[stream-auth] ALLOWED parent ${payload.action} path=${payload.path}`);

    return {
        allowed: true,
        expireAt: new Date(expiry).toISOString(),
    };
}

async function authorizeAdminSession(
    tokenHash: string,
    payload: MediaMTXAuthPayload,
): Promise<StreamAuthResult> {
    const { data: session, error: sessionError } = await supabaseAdmin
        .from('admin_camera_playback_sessions')
        .select('id, admin_id, camera_id, school_id, expires_at, status')
        .eq('token_hash', tokenHash)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (sessionError) {
        return deny('admin_session_query_error', payload, sessionError.message);
    }

    if (!session) {
        return deny('session_not_found_or_expired', payload);
    }

    const currentAccess = await getAdminCameraPlaybackAccess(
        session.admin_id,
        session.camera_id,
    );

    if (!currentAccess) {
        return deny(
            'admin_access_check_failed',
            payload,
            'Admin membership, camera, or live-viewing permission is no longer valid',
        );
    }

    if (
        currentAccess.cameraId !== session.camera_id ||
        currentAccess.schoolId !== session.school_id ||
        currentAccess.adminId !== session.admin_id ||
        currentAccess.streamPath !== payload.path
    ) {
        return deny('admin_access_mismatch', payload);
    }

    const expiry = new Date(session.expires_at).getTime();

    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
        return deny('admin_session_expired', payload);
    }

    const { error: activityError } = await supabaseAdmin
        .from('admin_camera_playback_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('status', 'active');

    if (activityError) {
        return deny('admin_activity_update_failed', payload, activityError.message);
    }

    console.log(`[stream-auth] ALLOWED admin ${payload.action} path=${payload.path}`);

    return {
        allowed: true,
        expireAt: new Date(expiry).toISOString(),
    };
}

export async function authorizeMediaMTXRequest(
    input: unknown,
): Promise<StreamAuthResult> {
    const parsed = authPayloadSchema.safeParse(input);

    if (!parsed.success) {
        console.warn(
            '[stream-auth] DENIED reason=invalid_payload',
            JSON.stringify(
                parsed.error.issues.map(
                    (issue) => issue.path.join('.') + ': ' + issue.message,
                ),
            ),
        );

        return { allowed: false };
    }

    const payload = parsed.data;

    console.log(
        `[stream-auth] request action=${payload.action} protocol=${payload.protocol || '-'} ` +
        `path=${payload.path || '-'} user=${payload.user || '-'} ` +
        `hasToken=${Boolean(payload.token)} ip=${payload.ip || '-'}`,
    );

    // Only our trusted publisher may send video into MediaMTX.
    if (payload.action === 'publish') {
        const userOk = payload.user === 'schoolview-publisher';
        const passwordOk = safeEqual(payload.password, env.STREAM_PUBLISH_SECRET);

        if (!userOk || !passwordOk) {
            return deny(
                'bad_publisher_credentials',
                payload,
                `userOk=${userOk} passwordOk=${passwordOk}`,
            );
        }

        console.log(`[stream-auth] ALLOWED publish path=${payload.path}`);
        return { allowed: true };
    }

    // Only authenticated playback/read requests are permitted.
    if (payload.action !== 'read' && payload.action !== 'playback') {
        return deny('action_not_allowed', payload);
    }

    if (!payload.token || !payload.path) {
        return deny(
            'missing_token_or_path',
            payload,
            `hasToken=${Boolean(payload.token)} hasPath=${Boolean(payload.path)}`,
        );
    }

    const tokenHash = createHash('sha256')
        .update(payload.token)
        .digest('hex');

    // First try the existing parent session system.
    const parentResult = await authorizeParentSession(tokenHash, payload);

    if (parentResult) {
        return parentResult;
    }

    // If no parent session matches, try the separate admin session system.
    return authorizeAdminSession(tokenHash, payload);
}
