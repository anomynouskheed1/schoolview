
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';

import { authenticateRequest } from '../middleware/authenticate.js';
import { getCameraPlaybackAccess } from '../services/camera-access.js';
import { getAdminCameraPlaybackAccess } from '../services/admin-camera-access.js';
import { supabaseAdmin } from '../lib/supabase.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const playbackRoutes: FastifyPluginAsync = async (app) => {
    // EXISTING PARENT PLAYBACK — preserved.
    app.post<{
        Params: { cameraId: string };
        Body: { parentStudentId?: string };
    }>(
        '/cameras/:cameraId/playback',
        async (request, reply) => {
            const user = await authenticateRequest(request);

            if (!user) {
                return reply.code(401).send({
                    success: false,
                    message: 'Authentication required.',
                });
            }

            const { cameraId } = request.params;
            const parentStudentId = request.body?.parentStudentId;

            if (!UUID_PATTERN.test(cameraId)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid camera ID.',
                });
            }

            if (
                typeof parentStudentId !== 'string' ||
                !UUID_PATTERN.test(parentStudentId)
            ) {
                return reply.code(400).send({
                    success: false,
                    message: 'A valid parent-child relationship is required.',
                });
            }

            const access = await getCameraPlaybackAccess(
                user.id,
                cameraId,
                parentStudentId,
            );

            if (!access) {
                return reply.code(403).send({
                    success: false,
                    message: 'You do not currently have permission to view this camera.',
                });
            }

            const token = randomBytes(32).toString('base64url');

            const tokenHash = createHash('sha256')
                .update(token)
                .digest('hex');

            const maximumSessionDuration = 60 * 60 * 1000;

            let expiresAt = Date.now() + maximumSessionDuration;

            if (access.grantExpiresAt) {
                expiresAt = Math.min(
                    expiresAt,
                    new Date(access.grantExpiresAt).getTime(),
                );
            }

            if (expiresAt <= Date.now()) {
                return reply.code(403).send({
                    success: false,
                    message: 'Camera access has expired.',
                });
            }

            const expiryDate = new Date(expiresAt).toISOString();

            const { data: session, error: sessionError } =
                await supabaseAdmin
                    .from('camera_playback_sessions')
                    .insert({
                        school_id: access.schoolId,
                        camera_id: access.cameraId,
                        parent_id: user.id,
                        parent_student_id: access.parentStudentId,
                        camera_access_id: access.cameraAccessId,
                        token_hash: tokenHash,
                        expires_at: expiryDate,
                    })
                    .select('id, expires_at')
                    .single();

            if (sessionError || !session) {
                request.log.error(
                    { error: sessionError },
                    'Unable to create playback session',
                );

                return reply.code(500).send({
                    success: false,
                    message: 'Unable to create playback session.',
                });
            }

            return reply.code(201).send({
                success: true,
                sessionId: session.id,
                cameraId: access.cameraId,
                parentStudentId: access.parentStudentId,
                streamPath: access.streamPath,
                playbackToken: token,
                expiresAt: session.expires_at,
            });
        },
    );

    // NEW ADMIN PLAYBACK SESSION.
    app.post<{
        Params: { cameraId: string };
    }>(
        '/cameras/:cameraId/admin-playback',
        async (request, reply) => {
            const user = await authenticateRequest(request);

            if (!user) {
                return reply.code(401).send({
                    success: false,
                    message: 'Authentication required.',
                });
            }

            const { cameraId } = request.params;

            if (!UUID_PATTERN.test(cameraId)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid camera ID.',
                });
            }

            const access = await getAdminCameraPlaybackAccess(
                user.id,
                cameraId,
            );

            if (!access) {
                return reply.code(403).send({
                    success: false,
                    message: 'You do not have permission to view this school camera, or its live stream is unavailable.',
                });
            }

            const token = randomBytes(32).toString('base64url');

            const tokenHash = createHash('sha256')
                .update(token)
                .digest('hex');

            const expiresAt = new Date(
                Date.now() + 60 * 60 * 1000,
            ).toISOString();

            const { data: session, error: sessionError } =
                await supabaseAdmin
                    .from('admin_camera_playback_sessions')
                    .insert({
                        school_id: access.schoolId,
                        camera_id: access.cameraId,
                        admin_id: user.id,
                        token_hash: tokenHash,
                        expires_at: expiresAt,
                    })
                    .select('id, expires_at')
                    .single();

            if (sessionError || !session) {
                request.log.error(
                    { error: sessionError },
                    'Unable to create admin playback session',
                );

                return reply.code(500).send({
                    success: false,
                    message: 'Unable to create admin playback session.',
                });
            }

            return reply.code(201).send({
                success: true,
                sessionId: session.id,
                cameraId: access.cameraId,
                streamPath: access.streamPath,
                playbackToken: token,
                expiresAt: session.expires_at,
            });
        },
    );

    // END AN ADMIN PLAYBACK SESSION.
    app.delete<{
        Params: {
            cameraId: string;
            sessionId: string;
        };
    }>(
        '/cameras/:cameraId/admin-playback/:sessionId',
        async (request, reply) => {
            const user = await authenticateRequest(request);

            if (!user) {
                return reply.code(401).send({
                    success: false,
                    message: 'Authentication required.',
                });
            }

            const { cameraId, sessionId } = request.params;

            if (
                !UUID_PATTERN.test(cameraId) ||
                !UUID_PATTERN.test(sessionId)
            ) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid camera or session ID.',
                });
            }

            const { data: session, error: sessionError } =
                await supabaseAdmin
                    .from('admin_camera_playback_sessions')
                    .update({
                        status: 'ended',
                        ended_at: new Date().toISOString(),
                    })
                    .eq('id', sessionId)
                    .eq('camera_id', cameraId)
                    .eq('admin_id', user.id)
                    .eq('status', 'active')
                    .select('id')
                    .maybeSingle();

            if (sessionError) {
                request.log.error(
                    { error: sessionError },
                    'Unable to end admin playback session',
                );

                return reply.code(500).send({
                    success: false,
                    message: 'Unable to end playback session.',
                });
            }

            return reply.send({
                success: true,
                ended: Boolean(session),
            });
        },
    );
};

export default playbackRoutes;
