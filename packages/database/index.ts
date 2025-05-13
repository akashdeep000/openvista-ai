import 'server-cli-only';

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { keys } from './keys';
import * as schema from './schema/index';

// Create a Pool using Neon WebSocket
const pool = new Pool({ connectionString: keys().DATABASE_URL });

// Export the Drizzle client
export const database = drizzle(pool, { schema });
