
import type { FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

export interface AuthenticatedUser {
    id: string;
    email?: string;
}

export async function authenticateRequest(
    request: FastifyRequest,
): Promise<AuthenticatedUser | null> {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
        return null;
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
        return null;
    }

    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !data.user) {
        return null;
    }

    return {
        id: data.user.id,
        email: data.user.email,
    };
}
