import { spinner } from '@clack/prompts';
import { database } from '@repo/database';
import { sql } from 'drizzle-orm';
import { type ExecaChildProcess, execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dataset } from './datasets';
import { keys } from './keys';

function getTableName(datasetValue: string, layerName?: string): string {
  const base = datasetValue.replace(/[^a-z0-9_]/gi, '_');
  return layerName ? `${base}_${layerName.replace(/[^a-z0-9_]/gi, '_')}` : base;
}

function getDatasetDir(value: string): string {
  return path.join(__dirname, '..', 'downloads', value);
}

const progressRegex = /\d+(?=\D*$)/;

/**
 * Detects the geometry type of a layer to determine the appropriate -nlt parameter
 * @param filePath Path to the source file
 * @param layer Name of the layer (optional for non-GDB sources)
 * @returns Appropriate -nlt value for ogr2ogr
 */

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
async function detectGeometryType(
  filePath: string,
  layer?: string
): Promise<string> {
  try {
    // Build the ogrinfo command
    const args = ['-so'];

    if (layer) {
      args.push(filePath, layer);
    } else {
      args.push(filePath);
    }

    const { stdout } = await execa('ogrinfo', args);

    // Look for geometry type in the output
    // Example: "Geometry: Multi Polygon" or "Geometry: 3D Point"
    const geometryLine = stdout
      .split('\n')
      .find((line) => line.trim().startsWith('Geometry:'));

    if (!geometryLine) {
      return 'PROMOTE_TO_MULTI'; // Default if unable to detect
    }

    const geometryType = geometryLine
      .trim()
      .replace('Geometry:', '')
      .trim()
      .toLowerCase();

    // Map the detected geometry type to an appropriate -nlt value
    if (geometryType.includes('polygon')) {
      if (geometryType.includes('multi')) {
        return 'MULTIPOLYGON';
      }
      return 'POLYGON';
    }
    if (geometryType.includes('line')) {
      if (geometryType.includes('multi')) {
        return 'MULTILINESTRING';
      }
      return 'LINESTRING';
    }
    if (geometryType.includes('point')) {
      if (geometryType.includes('multi')) {
        return 'MULTIPOINT';
      }
      return 'POINT';
    }
    if (geometryType.includes('geometry')) {
      return 'GEOMETRY';
    }

    // Default to PROMOTE_TO_MULTI if we can't determine the specific type
    return 'PROMOTE_TO_MULTI';
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.warn(
      `Failed to detect geometry type: ${error instanceof Error ? error.message : String(error)}`
    );
    return 'PROMOTE_TO_MULTI'; // Default fallback
  }
}

/**
 * Lists all layers in a GDB file
 * @param gdbPath Path to the GDB directory
 * @returns Array of layer names
 */
async function listGdbLayers(gdbPath: string): Promise<string[]> {
  const { stdout } = await execa('ogrinfo', ['-so', gdbPath]);

  // Extract layer names from ogrinfo output
  const layerLines = stdout
    .split('\n')
    .filter((line) => line.trim().startsWith('Layer:'));

  return layerLines
    .map((line) => {
      // Extract the layer name from lines like "Layer: NHDArea (3D Multi Polygon)"
      // biome-ignore lint/performance/useTopLevelRegex: <explanation>
      const match = line.match(/Layer:\s+([^\s(]+)/);
      return match ? match[1] : '';
    })
    .filter(Boolean);
}

/**
 * Import data from various geospatial formats into PostgreSQL
 */
export async function importData(dataset: Dataset) {
  const s = spinner();
  s.start(`Importing dataset: ${dataset.label}`);

  const datasetDir = getDatasetDir(dataset.value);
  const dbUrl = keys().DATABASE_URL;

  const files = await fs.readdir(datasetDir);
  const shpFile = files.find((f) => f.endsWith('.shp'));
  const gpkgFile = files.find((f) => f.endsWith('.gpkg'));
  const gdbDir = files.find((f) => f.endsWith('.gdb'));
  const pbfFile = files.find((f) => f.endsWith('.osm.pbf'));

  const fullPath = (filename: string) => path.join(datasetDir, filename);
  const pgConnectionString = dbUrl;

  try {
    let fileType: 'shp' | 'gpkg' | 'gdb' | 'pbf' | null = null;
    let inputPath: string | null = null;

    if (shpFile) {
      fileType = 'shp';
      inputPath = fullPath(shpFile);
    } else if (gpkgFile) {
      fileType = 'gpkg';
      inputPath = fullPath(gpkgFile);
    } else if (gdbDir) {
      fileType = 'gdb';
      inputPath = fullPath(gdbDir);
    } else if (pbfFile) {
      fileType = 'pbf';
      inputPath = fullPath(pbfFile);
    }

    if (!inputPath) {
      throw new Error('No supported file format found for import.');
    }

    if (fileType === 'gdb') {
      await importGdbLayers(dataset, inputPath, pgConnectionString, s);
    } else if (
      fileType === 'pbf' ||
      fileType === 'shp' ||
      fileType === 'gpkg'
    ) {
      await importSingleFile(
        dataset,
        fileType,
        inputPath,
        pgConnectionString,
        s
      );
    } else {
      s.stop(
        `Unsupported file type: ${fileType} for ${dataset.label} (Skipping)`
      );
      return;
    }

    s.stop(`Successfully imported ${dataset.label}`);
  } catch (error) {
    s.stop(
      `Failed to import ${dataset.label}: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
  }
}

/**
 * Import layers from a GDB file
 * If dataset.layers is defined, only import those specific layers
 * Otherwise import all layers in the GDB
 */
async function importGdbLayers(
  dataset: Dataset,
  gdbPath: string,
  pgConnectionString: string,
  s: ReturnType<typeof spinner>
) {
  let layersToImport: string[] = [];

  // If specific layers are defined in the dataset, use only those
  if (dataset.layers && dataset.layers.length > 0) {
    s.message(
      `Using ${dataset.layers.length} predefined layers for ${dataset.label}`
    );
    layersToImport = dataset.layers;
  } else {
    // Otherwise discover and import all layers
    s.message(`Discovering layers in GDB: ${dataset.label}`);
    layersToImport = await listGdbLayers(gdbPath);
    s.message(`Found ${layersToImport.length} layers in GDB: ${dataset.label}`);
  }

  // Keep track of successful and failed layers
  const successfulLayers: string[] = [];
  const failedLayers: string[] = [];

  for (const layer of layersToImport) {
    const tableName = getTableName(dataset.value, layer);
    const tempTableName = `${tableName}_temp`;

    try {
      s.message(`Importing layer ${layer} from ${dataset.label}`);

      // Drop the temp table if it exists
      await database.execute(
        // @ts-ignore
        sql.raw(`DROP TABLE IF EXISTS ${tempTableName} CASCADE`)
      );

      // Detect the appropriate geometry type for this layer
      s.message(`Detecting geometry type for layer ${layer}`);
      const geometryType = await detectGeometryType(gdbPath, layer);
      s.message(`Using geometry type ${geometryType} for layer ${layer}`);

      // Import this specific layer
      const importCommand = execa('ogr2ogr', [
        '-f',
        'PostgreSQL',
        `PG:${pgConnectionString}`,
        gdbPath,
        layer, // Specify the layer name
        '-nlt',
        geometryType, // Use the detected geometry type
        '-nln',
        tempTableName,
        '-overwrite',
        '-lco',
        'GEOMETRY_NAME=geom',
        '-lco',
        'FID=id',
        '--config',
        'PG_USE_COPY',
        'YES',
        '--config',
        'OGR_TRUNCATE_METADATA_TABLES',
        'NO',
        '-progress',
      ]);

      let lastPercent = 0;
      importCommand.stdout?.on('data', (output: string) => {
        const text = output.toString().trim();
        const match = text.match(progressRegex);
        if (match) {
          lastPercent = Number(match[0]);
          s.message(`Importing layer ${layer}: ${lastPercent}%`);
        }
      });

      await importCommand;

      // Rename the table and indexes
      s.message(`Renaming table ${tempTableName} to ${tableName}`);

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await database.transaction(async (tx: any) => {
        // Delete previous table if it exists
        await tx.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName} CASCADE`));
        // Rename the table
        await tx.execute(
          sql.raw(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`)
        );

        // Get the indexes associated with the tempTableName
        const indexes = (
          await tx.execute(
            sql.raw(
              `SELECT indexname FROM pg_indexes WHERE tablename = '${tableName}'`
            )
          )
        ).rows;

        // Loop through each index and rename it
        for (const row of indexes) {
          const indexname = row.indexname as string;
          const newIndexName = indexname.replace(tempTableName, tableName);

          // Rename the index
          await tx.execute(
            sql.raw(`ALTER INDEX ${indexname} RENAME TO ${newIndexName}`)
          );
        }
      });

      successfulLayers.push(layer);
      s.message(`Successfully imported layer ${layer}`);
    } catch (error) {
      failedLayers.push(layer);
      s.message(
        `Failed to import layer ${layer}: ${error instanceof Error ? error.message : String(error)}`
      );
      await database.execute(
        // @ts-ignore
        sql.raw(`DROP TABLE IF EXISTS ${tempTableName} CASCADE`)
      );
    }
  }

  // Summary message
  if (successfulLayers.length > 0) {
    s.message(
      `Successfully imported ${successfulLayers.length} layers: ${successfulLayers.join(', ')}`
    );
  }

  if (failedLayers.length > 0) {
    s.message(
      `Failed to import ${failedLayers.length} layers: ${failedLayers.join(', ')}`
    );
  }
}

/**
 * Import a single file (SHP, GPKG, PBF)
 */
async function importSingleFile(
  dataset: Dataset,
  fileType: 'shp' | 'gpkg' | 'pbf',
  inputPath: string,
  pgConnectionString: string,
  s: ReturnType<typeof spinner>
) {
  const tableName = getTableName(dataset.value);
  const tempTableName = `${tableName}_temp`;
  let importCommand: ExecaChildProcess | null = null;

  // biome-ignore lint/style/useDefaultSwitchClause: <explanation>
  switch (fileType) {
    case 'shp':
    case 'gpkg': {
      // Drop the temp table if it exists
      await database.execute(
        // @ts-ignore
        sql.raw(`DROP TABLE IF EXISTS ${tempTableName} CASCADE`)
      );
      // Detect the appropriate geometry type
      s.message(`Detecting geometry type for ${fileType} file`);
      const geometryType = await detectGeometryType(inputPath);
      s.message(`Using geometry type ${geometryType} for ${fileType} file`);

      importCommand = execa('ogr2ogr', [
        '-f',
        'PostgreSQL',
        `PG:${pgConnectionString}`,
        inputPath,
        '-nlt',
        geometryType, // Use the detected geometry type
        '-nln',
        tempTableName,
        '-overwrite',
        '-lco',
        'GEOMETRY_NAME=geom',
        '-lco',
        'FID=id',
        '--config',
        'PG_USE_COPY',
        'YES',
        '--config',
        'OGR_TRUNCATE_METADATA_TABLES',
        'NO',
        '-progress',
      ]);
      break;
    }
    case 'pbf': {
      importCommand = execa('osm2pgsql', [
        '--create',
        `--database=${pgConnectionString}`,
        '--output=flex',
        `--style=${path.join(__dirname, 'osm-filter.lua')}`,
        '--prefix',
        tableName,
        '--slim',
        '--drop',
        '--number-processes=4',
        '--log-progress=true',
        inputPath,
      ]);
      break;
    }
  }

  if (importCommand) {
    let lastPercent = 0;
    importCommand.stdout?.on('data', (output: string) => {
      const text = output.toString().trim();
      const match = text.match(progressRegex);
      if (match) {
        lastPercent = Number(match[0]);
        s.message(`Importing ${dataset.label}: ${lastPercent}%`);
      }
    });

    s.message(`Importing ${dataset.label}`);
    await importCommand;
    s.message(`Successfully imported ${dataset.label}`);

    if (fileType === 'pbf') {
      return;
    }
    // Rename the table and indexes
    s.message(`Renaming table ${tempTableName} to ${tableName}`);

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    await database.transaction(async (tx: any) => {
      // Delete previous table if it exists
      await tx.execute(sql.raw(`DROP TABLE IF EXISTS ${tableName} CASCADE`));
      // Rename the table
      await tx.execute(
        sql.raw(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`)
      );

      // Get the indexes associated with the tempTableName
      const indexes = (
        await tx.execute(
          sql.raw(
            `SELECT indexname FROM pg_indexes WHERE tablename = '${tableName}'`
          )
        )
      ).rows;

      // Loop through each index and rename it
      for (const row of indexes) {
        const indexname = row.indexname as string;
        const newIndexName = indexname.replace(tempTableName, tableName);

        // Rename the index
        await tx.execute(
          sql.raw(`ALTER INDEX ${indexname} RENAME TO ${newIndexName}`)
        );
      }
    });
  }
}
