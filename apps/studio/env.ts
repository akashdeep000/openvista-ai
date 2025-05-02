import { keys as db } from '@repo/database/keys';
import { createEnv } from '@t3-oss/env-nextjs';

export const env = createEnv({
  extends: [db()],
  server: {},
  client: {},
  runtimeEnv: {},
});
