import got from 'got';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import PQueue from 'p-queue';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export type DownloadProgressCallback = (
  transferred: number,
  total: number | undefined
) => void;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export async function downloadMultipartFile(
  url: string,
  outputPath: string,
  options: {
    concurrency?: number;
    onProgress?: DownloadProgressCallback;
    retries?: number;
    retryDelayMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<void> {
  const concurrency = options.concurrency ?? 1;
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  const currentFiles = await fs.readdir(outputDir);

  const existingFiles = currentFiles.filter(
    (f) =>
      f.endsWith('.shp') ||
      f.endsWith('.gpkg') ||
      f.endsWith('.gdb') ||
      f.endsWith('osm.pbf') ||
      f.endsWith('.zip')
  );

  if (existingFiles.length > 0) {
    return;
  }

  const { headers } = await got.head(url);
  const totalSize = Number.parseInt(headers['content-length'] || '0', 10);
  const rangeSupport = headers['accept-ranges'] === 'bytes';
  const lastModified = headers['last-modified'] || '';

  if (concurrency <= 1 || !rangeSupport || totalSize === 0) {
    const tempPath = `${outputPath}.temp`;
    const res = got.stream(url, { signal: options.signal });
    const writeStream = fsSync.createWriteStream(tempPath);
    let downloaded = 0;
    const total = Number.parseInt(
      (await got.head(url)).headers['content-length'] || '0',
      10
    );

    res.on('data', (d: Buffer) => {
      downloaded += d.length;
      options.onProgress?.(downloaded, total);
    });

    await new Promise<void>((resolve, reject) => {
      const cleanupOnError = () => {
        try {
          fsSync.unlinkSync(tempPath);
        } catch {
          // Ignore error
        }
        reject();
      };
      res.on('error', cleanupOnError);
      writeStream.on('error', cleanupOnError);
      writeStream.on('finish', resolve);
      res.pipe(writeStream);
    });

    await fs.rename(tempPath, outputPath);
    return;
  }

  const tempDir = path.join(outputDir, 'temp');
  const metaPath = path.join(tempDir, 'meta.json');
  const finalTempPath = `${outputPath}.temp`;
  const retries = options.retries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 1000;

  await fs.mkdir(tempDir, { recursive: true });

  const chunks = getByteRanges(totalSize, CHUNK_SIZE);

  let meta: Record<string, number> = {};
  try {
    const exists = fsSync.existsSync(metaPath);
    if (exists) {
      const saved = JSON.parse(fsSync.readFileSync(metaPath, 'utf-8'));
      if (
        saved.lastModified === lastModified &&
        saved.totalSize === totalSize
      ) {
        meta = saved.chunks;
      }
    }
  } catch (_) {
    meta = {};
  }

  let downloaded = Object.values(meta).reduce((a, b) => a + b, 0);

  const queue = new PQueue({ concurrency });
  let stop = false;

  const saveMeta = async () => {
    const tempMeta = `${metaPath}.tmp`;
    await fs.mkdir(path.dirname(tempMeta), { recursive: true });
    await fs.writeFile(
      tempMeta,
      JSON.stringify({ chunks: meta, totalSize, lastModified })
    );
    await fs.rename(tempMeta, metaPath);
  };

  const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

  const downloadChunk = async (
    i: number,
    start: number,
    end: number
  ): Promise<void> => {
    const chunkPath = path.join(tempDir, `chunk-${i}.part`);
    const tempChunk = `${chunkPath}.tmp`;

    try {
      const stat = await fs.stat(chunkPath);
      if (stat.size === end - start + 1) {
        return; // Already downloaded
      }
    } catch {
      // Chunk doesn't exist or error checking size — proceed to download
    }

    let attempt = 0;
    while (attempt <= retries) {
      try {
        await fs.mkdir(path.dirname(tempChunk), { recursive: true });
        const writeStream = fsSync.createWriteStream(tempChunk);
        const res = got.stream(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: options.signal,
        });

        await new Promise<void>((resolve, reject) => {
          let chunkDownloaded = 0;
          let errored = false;

          const cleanup = (err: Error) => {
            if (errored) {
              return;
            }
            errored = true;
            downloaded -= chunkDownloaded;
            options.onProgress?.(downloaded, totalSize);

            try {
              fsSync.unlinkSync(tempChunk);
            } catch {
              // Ignore error
            }
            reject(err);
          };

          res.on('data', (chunk: Buffer) => {
            chunkDownloaded += chunk.length;
            downloaded += chunk.length;
            options.onProgress?.(downloaded, totalSize);
          });

          res.on('error', (err) =>
            cleanup(new Error(`Stream error on chunk ${i}: ${err.message}`))
          );
          writeStream.on('error', (err) =>
            cleanup(new Error(`Write error on chunk ${i}: ${err.message}`))
          );

          writeStream.on('finish', async () => {
            try {
              const { size } = await fs.stat(tempChunk);
              if (size === end - start + 1) {
                await fs.rename(tempChunk, chunkPath);
                meta[i] = size;
                await saveMeta();
                return resolve();
              }
              return cleanup(
                new Error(
                  `Incomplete chunk ${i}: expected ${end - start + 1}, got ${size}`
                )
              );
            } catch (err) {
              return cleanup(
                new Error(
                  `Post-download check failed for chunk ${i}: ${(err as Error).message}`
                )
              );
            }
          });

          res.pipe(writeStream);
        });

        return;
      } catch (err) {
        attempt++;
        if (attempt > retries) {
          throw new Error(
            `Chunk ${i} failed after ${retries} retries: ${(err as Error).message}`
          );
        }
        await delay(retryDelayMs);
      }
    }
  };

  for (let i = 0; i < chunks.length; i++) {
    if (!meta[i]) {
      const [start, end] = chunks[i];
      queue.add(() => downloadChunk(i, start, end));
    }
  }

  const handleExit = async () => {
    if (!stop) {
      stop = true;
      await saveMeta();
      await queue.onIdle();
      process.exit(0);
    }
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  if (options.signal) {
    options.signal.addEventListener('abort', handleExit);
  }

  await queue.onIdle();

  // Ensure directory for the temp output file exists
  await fs.mkdir(path.dirname(finalTempPath), { recursive: true });

  const writeFinal = fsSync.createWriteStream(finalTempPath, { flags: 'w' });

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(tempDir, `chunk-${i}.part`);
    await new Promise<void>((resolve, reject) => {
      const readStream = fsSync.createReadStream(chunkPath);
      readStream.pipe(writeFinal, { end: false });
      readStream.on('end', resolve);
      readStream.on('error', reject);
    });
  }

  // Manually end the final writable stream after all chunks
  writeFinal.end();

  // Wait for the stream to finish writing
  await new Promise<void>((resolve, reject) => {
    writeFinal.on('finish', resolve);
    writeFinal.on('error', reject);
  });

  // Move the final temp file to the desired output path
  await fs.rename(finalTempPath, outputPath);
  await fs.rm(tempDir, { recursive: true });
}

function getByteRanges(
  totalLength: number,
  maxChunkSize: number
): [number, number][] {
  const ranges: [number, number][] = [];
  let start = 0;

  while (start < totalLength) {
    const end = Math.min(start + maxChunkSize - 1, totalLength - 1);
    ranges.push([start, end]);
    start = end + 1;
  }

  return ranges;
}
