
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

import { env } from './config/env.js';
import playbackRoutes from './routes/playback.js';
import mediaMTXAuthRoutes from './routes/mediamtx-auth.js';

function configureErrorHandler(app: FastifyInstance) {
    app.setErrorHandler((error, request, reply) => {
        request.log.error(error);

        const statusCode =
            typeof error === 'object' &&
                error !== null &&
                'statusCode' in error &&
                typeof error.statusCode === 'number' &&
                error.statusCode >= 400
                ? error.statusCode
                : 500;

        const message =
            error instanceof Error
                ? error.message
                : 'An unexpected server error occurred.';

        return reply.status(statusCode).send({
            success: false,
            error:
                statusCode >= 500
                    ? 'An unexpected server error occurred.'
                    : message,
        });
    });
}

// Public SchoolView API.
// This server contains health and playback routes only.
const app = Fastify({
    logger: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers.set-cookie',
        ],
    },
    trustProxy: env.NODE_ENV === 'production',
});

await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.get('/health', async () => ({
    success: true,
    service: 'schoolview-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
}));

await app.register(playbackRoutes, {
    prefix: '/api',
});

configureErrorHandler(app);

// Private MediaMTX authorization server.
// It is deliberately bound to loopback and is not part of the public API.
const internalAuthApp = Fastify({
    logger: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: [
            'req.headers.authorization',
            'req.headers.cookie',
        ],
    },
});

await internalAuthApp.register(mediaMTXAuthRoutes, {
    prefix: '/internal/mediamtx',
});

configureErrorHandler(internalAuthApp);

try {
    await internalAuthApp.listen({
        host: '127.0.0.1',
        port: env.INTERNAL_AUTH_PORT,
    });

    app.log.info(
        `Private MediaMTX authorization listening on 127.0.0.1:${env.INTERNAL_AUTH_PORT}`,
    );

    await app.listen({
        host: env.HOST,
        port: env.PORT,
    });

    app.log.info(
        `SchoolView API listening on ${env.HOST}:${env.PORT}`,
    );
} catch (error) {
    app.log.error(error);
    await internalAuthApp.close().catch(() => undefined);
    process.exit(1);
}
