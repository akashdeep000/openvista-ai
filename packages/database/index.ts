import { drizzle } from 'drizzle-orm/node-postgres';
import 'server-cli-only';

import { keys } from './keys';
import * as schema from './schema/index';

// Export the Drizzle client
export const database = drizzle(keys().DATABASE_URL, { schema });
