
-- ============================================================
-- SCHOOLVIEW MIGRATION 008
-- Streaming infrastructure foundation
-- Reuses existing schools, cameras, camera_access and
-- parent_students tables.
-- ============================================================

-- 1. Camera-to-stream configuration
CREATE TABLE IF NOT EXISTS public.camera_stream_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES public.schools(id) ON DELETE CASCADE,

    camera_id UUID NOT NULL UNIQUE
        REFERENCES public.cameras(id) ON DELETE CASCADE,

    -- The path used by MediaMTX, e.g. schoolview/sunrise/grade-1
    stream_path TEXT NOT NULL UNIQUE,

    source_type TEXT NOT NULL DEFAULT 'ip_camera'
        CHECK (
            source_type IN (
                'laptop_webcam',
                'ip_camera',
                'nvr',
                'test_video'
            )
        ),

    ingest_protocol TEXT NOT NULL DEFAULT 'rtsp'
        CHECK (
            ingest_protocol IN (
                'rtsp',
                'rtmp',
                'webrtc'
            )
        ),

    status TEXT NOT NULL DEFAULT 'offline'
        CHECK (
            status IN (
                'offline',
                'connecting',
                'online',
                'error',
                'disabled'
            )
        ),

    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    last_seen_at TIMESTAMPTZ,
    last_error TEXT,

    -- Non-secret configuration only.
    -- Never put RTSP passwords or private tokens here.
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT camera_stream_path_valid
        CHECK (
            length(stream_path) BETWEEN 1 AND 200
            AND stream_path !~ '\s'
        )
);

CREATE INDEX IF NOT EXISTS idx_camera_stream_configs_school
    ON public.camera_stream_configs(school_id);

CREATE INDEX IF NOT EXISTS idx_camera_stream_configs_status
    ON public.camera_stream_configs(status);


-- 2. Parent playback sessions
-- Only the trusted API should create/read/update these records.
-- Store a SHA-256 hash of a playback token, never the raw token.

CREATE TABLE IF NOT EXISTS public.camera_playback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES public.schools(id) ON DELETE CASCADE,

    camera_id UUID NOT NULL
        REFERENCES public.cameras(id) ON DELETE CASCADE,

    parent_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    parent_student_id UUID NOT NULL
        REFERENCES public.parent_students(id) ON DELETE CASCADE,

    camera_access_id UUID NOT NULL
        REFERENCES public.camera_access(id) ON DELETE CASCADE,

    token_hash CHAR(64) NOT NULL UNIQUE,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'ended',
                'revoked',
                'expired'
            )
        ),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    ended_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT playback_session_expiry_valid
        CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_parent
    ON public.camera_playback_sessions(parent_id);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_camera
    ON public.camera_playback_sessions(camera_id);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_active
    ON public.camera_playback_sessions(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_access
    ON public.camera_playback_sessions(camera_access_id);


-- 3. Enable Row Level Security

ALTER TABLE public.camera_stream_configs
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.camera_playback_sessions
    ENABLE ROW LEVEL SECURITY;


-- 4. School admins can manage their school's stream configuration

DROP POLICY IF EXISTS
    "School admins manage camera stream configurations"
    ON public.camera_stream_configs;

CREATE POLICY
    "School admins manage camera stream configurations"
ON public.camera_stream_configs
FOR ALL
TO authenticated
USING (
    public.is_school_member(
        school_id,
        ARRAY['school_admin']::TEXT[]
    )
)
WITH CHECK (
    public.is_school_member(
        school_id,
        ARRAY['school_admin']::TEXT[]
    )
);


-- 5. Playback sessions are private to the trusted server.
-- No authenticated or anonymous client policies are created.

REVOKE ALL ON public.camera_playback_sessions
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.camera_stream_configs
    FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.camera_stream_configs
    TO authenticated;

-- Service role is used by our trusted backend.
GRANT ALL ON public.camera_stream_configs
    TO service_role;

GRANT ALL ON public.camera_playback_sessions
    TO service_role;


-- 6. Updated timestamp trigger for stream configuration

CREATE OR REPLACE FUNCTION public.update_camera_stream_config_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
    update_camera_stream_config_timestamp_trigger
    ON public.camera_stream_configs;

CREATE TRIGGER update_camera_stream_config_timestamp_trigger
BEFORE UPDATE ON public.camera_stream_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_camera_stream_config_timestamp();


-- ============================================================
-- END MIGRATION 008
-- ============================================================
