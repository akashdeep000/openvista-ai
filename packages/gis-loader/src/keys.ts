import { createEnv } from '@t3-oss/env-nextjs';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: '../../.env',
});

export const keys = () =>
  createEnv({
    server: {
      DATABASE_URL: z.string().min(1).url(),
    },
    runtimeEnv: {
      DATABASE_URL: process.env.DATABASE_URL,
    },
  });
