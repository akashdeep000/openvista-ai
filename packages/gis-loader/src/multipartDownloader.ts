import got from 'got';
import MultipartDownload from 'multipart-download';
import * as fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

type DownloadProgressCallback = (
  transferred: number,
  total: number | undefined
) => void;
const MAX_CONCURRENCY = 1;

/**
 * Downloads a file with support for multipart downloading when possible
 * @param url URL of the file to download
 * @param outputPath Path where the file should be saved
 * @param options Configuration options
 * @returns Promise that resolves when download completes
 */
export async function downloadMultipartFile(
  url: string,
  outputPath: string,
  options: {
    concurrency?: number;
    onProgress?: DownloadProgressCallback;
  } = {}
): Promise<void> {
  const concurrency = options.concurrency || MAX_CONCURRENCY;
  const onProgress = options.onProgress;

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    // Make a HEAD request to check if server supports partial requests
    got
      .head(url)
      .then((headResponse) => {
        const contentLength = headResponse.headers['content-length'];
        const acceptRanges = headResponse.headers['accept-ranges'];

        // Check if server supports multipart download
        const supportsRanges = acceptRanges === 'bytes' && contentLength;

        if (supportsRanges) {
          // Use multipart download with multiple connections
          const downloader = new MultipartDownload();
          const totalSize = Number.parseInt(contentLength, 10);
          let downloadedBytes = 0;

          // Track download progress
          downloader.on('data', (data: Buffer | string) => {
            downloadedBytes += Buffer.isBuffer(data)
              ? data.length
              : Buffer.byteLength(data);

            if (onProgress) {
              onProgress(downloadedBytes, totalSize);
            }
          });

          downloader.on('end', () => {
            resolve();
          });

          downloader.on('error', (err: Error) => {
            reject(err);
          });

          // Start the download
          downloader.start(url, {
            numOfConnections: concurrency,
            saveDirectory: path.dirname(outputPath),
            fileName: path.basename(outputPath),
          });
        } else {
          // Fallback to normal download if multipart isn't supported
          performSingleDownload(url, outputPath, onProgress)
            .then(resolve)
            .catch(reject);
        }
      })
      .catch(() => {
        // If HEAD request fails, try normal download
        performSingleDownload(url, outputPath, onProgress)
          .then(resolve)
          .catch(reject);
      });
  });
}

/**
 * Performs a single connection download when multipart isn't supported
 * @param url URL to download from
 * @param outputPath Path to save the file
 * @param onProgress Optional progress callback
 * @returns Promise that resolves when download completes
 */
async function performSingleDownload(
  url: string,
  outputPath: string,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  // Create a write stream to the output file
  const writeStream = fsSync.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    let downloadedBytes = 0;
    let totalBytes: number | undefined;

    const downloadStream = got
      .stream(url)
      .on(
        'response',
        (response: { headers: Record<string, string | undefined> }) => {
          if (response.headers['content-length']) {
            totalBytes = Number.parseInt(
              response.headers['content-length'],
              10
            );
          }
        }
      )
      .on(
        'downloadProgress',
        (progress: { transferred: number; percent?: number }) => {
          downloadedBytes = progress.transferred;
          if (onProgress) {
            onProgress(downloadedBytes, totalBytes);
          }
        }
      )
      .on('error', (error) => {
        writeStream.destroy();
        reject(error);
      });

    // Pipe the download to the file
    const fileStream = downloadStream.pipe(writeStream);

    fileStream.on('finish', () => {
      resolve();
    });

    fileStream.on('error', (error) => {
      reject(error);
    });
  });
}
