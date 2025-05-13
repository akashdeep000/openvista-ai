import { spinner } from '@clack/prompts';
import { database } from '@repo/database';
import { sql } from 'drizzle-orm';
import { type ExecaChildProcess, execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dataset } from './datasets';
import { keys } from './keys';

function getTableName(datasetValue: string): string {
  return datasetValue.replace(/[^a-z0-9_]/gi, '_');
}

function getDatasetDir(value: string): string {
  return path.join(__dirname, '..', 'downloads', value);
}

const progressRegex = /\d+(?=\D*$)/;

export async function importData(dataset: Dataset) {
  const s = spinner();
  s.start(`Importing dataset: ${dataset.label}`);

  const datasetDir = getDatasetDir(dataset.value);
  const dbUrl = keys().DATABASE_URL;

  const tableName = getTableName(dataset.value);
  const tempTableName = `${tableName}_temp`;

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
    let importCommand: ExecaChildProcess | null = null;

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

    switch (fileType) {
      case 'shp':
      case 'gpkg':
      case 'gdb':
        // biome-ignore lint/style/useSingleCaseStatement: <explanation>
        if (!inputPath) {
          throw new Error(`Input path not found for file type: ${fileType}`);
        }
        importCommand = execa('ogr2ogr', [
          '-f',
          'PostgreSQL',
          `PG:${pgConnectionString}`,
          inputPath,
          '-nlt',
          'MULTIPOLYGON',
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
      case 'pbf': {
        if (!inputPath) {
          throw new Error(`Input path not found for file type: ${fileType}`);
        }
        const dbUrlObj = new URL(dbUrl);
        importCommand = execa('osm2pgsql', [
          '--create',
          '--database',
          dbUrlObj.pathname.replace('/', ''),
          '--username',
          dbUrlObj.username,
          '--host',
          dbUrlObj.hostname,
          '--port',
          dbUrlObj.port || '5432',
          '--table',
          tempTableName,
          '--slim',
          '--hstore',
          '--drop',
          '--accept-ways',
          '--number-processes=4',
          inputPath,
        ]);
        break;
      }
      default:
        throw new Error('No supported file format found for import.');
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
      s.message(`Dropping table ${tempTableName}`);
      await database.execute(
        sql.raw(`DROP TABLE IF EXISTS ${tempTableName} CASCADE`)
      );
      s.message(`Importing ${dataset.label}`);
      await importCommand;
      s.message(`Successfully imported ${dataset.label}`);
    }

    // Rename the table and indexes
    s.message(`Renaming table ${tempTableName} to ${tableName}`);
    await database.transaction(async (tx) => {
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
    s.stop(`Successfully imported ${dataset.label}`);
  } catch (error) {
    s.stop(
      `Failed to import ${dataset.label}: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
    await database.execute(
      sql.raw(`DROP TABLE IF EXISTS ${tempTableName} CASCADE`)
    );
  }
}
