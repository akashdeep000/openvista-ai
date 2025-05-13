import { pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
// Assuming PostGIS extension is enabled and 'geometry' type is available
// You might need to define a custom type or use a library for PostGIS types with Drizzle
// For now, we'll use a placeholder or a simple text type if a proper geometry type isn't directly available
// A better approach would be to use a Drizzle adapter that supports PostGIS or define a custom column type.
// Let's assume a 'geometry' type exists for now, or we'll use text and handle conversion.
// For a real implementation, you'd likely use a library like 'drizzle-orm-pg-gis' if available or define a custom type.

// Placeholder for a geometry type if not directly supported
// declare type Geometry = any; // Replace with actual PostGIS geometry type if available

export const gisFeatures = pgTable('gis_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  dataset: text('dataset').notNull(), // e.g., 'tiger-states', 'tiger-counties'
  // This is a placeholder. A proper PostGIS geometry type should be used.
  // You might need to define a custom column type or use a Drizzle extension for PostGIS.
  // For example, using a hypothetical 'geometry' type:
  // geometry: geometry('geom', { type: 'geometry', srid: 4326 }).notNull(),
  // Using text as a temporary placeholder:
  geometry: text('geometry').notNull(), // Store geometry as WKT or GeoJSON string temporarily
  properties: text('properties'), // Store feature properties as JSON string
});

// You might want to add indexes on the geometry column for spatial queries
// e.g., db.execute(sql`CREATE INDEX gis_features_geom_idx ON gis_features USING GIST (geometry);`);

export const datasetImports = pgTable('dataset_imports', {
  id: serial('id').primaryKey(),
  dataset: text('dataset').notNull(),
  status: text('status').notNull(), // 'success' | 'failed' | 'skipped'
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  error: text('error'),
});
