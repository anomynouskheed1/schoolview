import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().default(4000),
    INTERNAL_AUTH_PORT: z.coerce.number().int().positive().default(4001),

    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    MEDIAMTX_API_URL: z.string().url().default('http://127.0.0.1:9997'),
    MEDIAMTX_API_USERNAME: z.string().default(''),
    MEDIAMTX_API_PASSWORD: z.string().default(''),

    STREAMING_INTERNAL_SECRET: z.string().min(32),
    STREAM_PUBLISH_SECRET: z.string().min(32),

    CORS_ORIGINS: z
        .string()
        .default('http://localhost:5173,http://localhost:5174,http://localhost:8081')
        .transform((value) =>
            value
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
        ),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error('Invalid API environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('API environment configuration is invalid.');
}

export const env = result.data;