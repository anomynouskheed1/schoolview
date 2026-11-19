import type { FastifyPluginAsync } from 'fastify';
import { authorizeMediaMTXRequest } from '../services/stream-auth.js';

const mediaMTXAuthRoutes: FastifyPluginAsync = async (app) => {
    app.post('/auth', async (request, reply) => {
        const result = await authorizeMediaMTXRequest(request.body);

        if (!result.allowed) {
            return reply.code(401).send({
                success: false,
                message: 'Stream authentication failed.',
            });
        }

        return reply.code(200).send({
            expireAt: result.expireAt,
        });
    });
};

export default mediaMTXAuthRoutes;