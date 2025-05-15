import fs from 'node:fs/promises';
import path from 'node:path';
import unzipper from 'unzipper';
import type { Dataset } from './datasets';
import { DownloadProgress } from './downloadProgress';
import { downloadMultipartFile } from './multipartDownloader';

export async function downloadDataset(dataset: Dataset): Promise<void> {
  const urlParts = dataset.downloadUrl.split('/');
  const filename = urlParts.at(-1);
  if (!filename) {
    throw new Error('Invalid download URL');
  }
  const outputPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'downloads',
    dataset.value, // Use dataset value as subdirectory
    filename // Use filename from URL
  );
  const progress = new DownloadProgress(`Downloading ${dataset.label}`);
  progress.start();

  try {
    await downloadMultipartFile(dataset.downloadUrl, outputPath, {
      onProgress: (transferred, total) => {
        progress.update(transferred, total);
      },
      concurrency: dataset.partial ? 32 : undefined,
    });

    await ifExists(outputPath, async () => {
      if (filename.endsWith('.zip')) {
        progress.message('Extracting zip file...');
        await (await unzipper.Open.file(outputPath)).extract({
          path: path.dirname(outputPath),
        });
        await fs.unlink(outputPath);
      }
    });
    progress.stop(`Successfully downloaded ${dataset.label}`);
  } catch (error) {
    progress.stop(
      `Failed to download ${dataset.label}: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
    throw error; // Re-throw the error after stopping the spinner
  }
}

const ifExists = async (path: string, fn: () => Promise<void>) => {
  try {
    await fs.stat(path);
    await fn();
  } catch {
    // Ignore error
  }
};
