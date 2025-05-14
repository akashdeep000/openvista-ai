#!/usr/bin/env node

import { multiselect, outro, spinner } from '@clack/prompts';
import { database } from '@repo/database';
import { program } from 'commander';
import { sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { datasets } from './datasets';
import { downloadDataset } from './downloader';
import { importData } from './importer';

program
  .command('download')
  .description('Download GIS data from selected sources')
  .action(async () => {
    const selectedDatasetValues = await multiselect({
      message: 'Select datasets to download:',
      options: datasets.map((dataset) => ({
        value: dataset.value,
        label: dataset.label,
      })),
      initialValues: datasets.map((dataset) => dataset.value),
      required: true,
    });

    if (Array.isArray(selectedDatasetValues)) {
      for (const datasetValue of selectedDatasetValues) {
        const dataset = datasets.find((d) => d.value === datasetValue);
        if (dataset) {
          await downloadDataset(dataset);
        }
      }
    } else {
      // User cancelled the prompt
      outro('Operation cancelled.');
      process.exit(0);
    }

    outro('Download process finished.');
  });

program
  .command('import')
  .description('Import downloaded GIS data into the database')
  .action(async () => {
    const downloadedDatasetsFolders = await fs.readdir(
      path.join(__dirname, '..', 'downloads')
    );
    const selectedDatasetValues = await multiselect({
      message: 'Select datasets to import:',
      options: datasets
        .map((dataset) => ({
          value: dataset.value,
          label: dataset.label,
        }))
        .filter((dataset) => downloadedDatasetsFolders.includes(dataset.value)),
      initialValues: datasets.map((dataset) => dataset.value),
      required: true,
    });

    if (Array.isArray(selectedDatasetValues)) {
      const s = spinner();
      try {
        s.start('Setting up database extensions');
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        await database.transaction(async (tx: any) => {
          await tx.execute(sql.raw('CREATE EXTENSION IF NOT EXISTS postgis'));
          await tx.execute(
            sql.raw('CREATE EXTENSION IF NOT EXISTS postgis_topology')
          );
          await tx.execute(
            sql.raw('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch')
          );
          await tx.execute(
            sql.raw('CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder')
          );
          await tx.execute(sql.raw('CREATE EXTENSION IF NOT EXISTS hstore'));
        });
        s.stop('Successfully set up database extensions');
      } catch (error) {
        s.stop('Failed to set up database extensions');
        // biome-ignore lint/suspicious/noConsole: <explanation>
        console.error(error);

        process.exit(1);
      }
      for (const datasetValue of selectedDatasetValues) {
        const dataset = datasets.find((d) => d.value === datasetValue);
        if (dataset) {
          await importData(dataset);
        }
      }
    } else {
      // User cancelled the prompt
      outro('Operation cancelled.');
      process.exit(0);
    }

    outro('Import process finished.');
  });

program.parse(process.argv);
