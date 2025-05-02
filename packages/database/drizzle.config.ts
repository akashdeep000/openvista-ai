import { defineConfig } from 'drizzle-kit';
import path from 'node:path';
import { keys } from './keys';

export default defineConfig({
  schema: path.join(__dirname, './schema/index.ts'),
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: keys().DATABASE_URL,
  },
});
