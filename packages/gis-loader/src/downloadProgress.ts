import { spinner } from '@clack/prompts';
import pc from 'picocolors';

// Helper function to format bytes into readable format (KB, MB, GB)
export function formatBytes(bytes: number, decimals = 2): string {
  // biome-ignore lint/style/useBlockStatements: <explanation>
  if (!Number.isFinite(bytes) || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

// Helper function to format seconds into mm:ss or hh:mm:ss
export function formatEta(seconds: number): string {
  // biome-ignore lint/style/useBlockStatements: <explanation>
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  // biome-ignore lint/style/useBlockStatements: <explanation>
  if (h > 0) parts.push(h.toString().padStart(2, '0'));
  parts.push(m.toString().padStart(2, '0'));
  parts.push(s.toString().padStart(2, '0'));
  return parts.join(':');
}

// Class to manage download progress and spinner updates
export class DownloadProgress {
  private s = spinner();
  private initialMessage: string;
  private startTime: number;
  private lastBytes = 0;
  private lastTime: number;
  private speedSamples: number[] = [];
  private SAMPLE_SIZE = 5; // Number of samples for moving average
  private lastUpdate = 0; // Track last update time
  private lastEtaSeconds = Number.POSITIVE_INFINITY;
  private lastAverageSpeed = 0;

  constructor(initialMessage: string) {
    this.initialMessage = initialMessage;
    this.startTime = Date.now();
    this.lastTime = this.startTime;
  }

  start() {
    this.s.start(this.initialMessage);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
  update(transferred: number, total?: number) {
    const currentTime = Date.now();
    const currentBytes = transferred;
    const totalSize = total;
    const percent = totalSize
      ? Math.min(100, Math.round((currentBytes / totalSize) * 100))
      : 0;

    // Only update ETA and speed calculations once per second
    const updateEtaSpeed = currentTime - this.lastUpdate >= 1000;
    if (updateEtaSpeed) {
      this.lastUpdate = currentTime;

      const timeDiff = (currentTime - this.lastTime) / 1000; // seconds
      const bytesDiff = currentBytes - this.lastBytes;

      // Calculate instantaneous speed if time has passed
      if (timeDiff > 0) {
        const instantaneousSpeed = bytesDiff / timeDiff; // Bytes per second
        this.speedSamples.push(instantaneousSpeed);
        if (this.speedSamples.length > this.SAMPLE_SIZE) {
          this.speedSamples.shift(); // Remove the oldest sample
        }
      }

      // Calculate average speed from samples
      const averageSpeed =
        this.speedSamples.length > 0
          ? this.speedSamples.reduce((sum, speed) => sum + speed, 0) /
            this.speedSamples.length
          : 0;

      this.lastBytes = currentBytes;
      this.lastTime = currentTime;

      const remainingBytes = totalSize ? totalSize - currentBytes : 0;
      const etaSeconds =
        averageSpeed > 0
          ? remainingBytes / averageSpeed
          : Number.POSITIVE_INFINITY;

      // Update the last stored ETA and speed
      this.lastEtaSeconds = etaSeconds;
      this.lastAverageSpeed = averageSpeed;
    }

    // Construct the message using current progress (always updated) and last stored ETA/speed (updated once per second)
    let message = pc.blue(this.initialMessage); // Colorize initial message
    if (totalSize) {
      const progressPart = `${pc.cyan(`[${percent}%]`)} ${pc.green(formatBytes(currentBytes))} / ${formatBytes(totalSize)} `;
      message = `${message} ${progressPart}`;
      // Append ETA and speed only if they were updated in this tick or if we have previous values
      if (
        updateEtaSpeed ||
        this.lastEtaSeconds !== Number.POSITIVE_INFINITY ||
        this.lastAverageSpeed > 0
      ) {
        const etaSpeedPart = `| ETA: ${pc.yellow(formatEta(this.lastEtaSeconds))} @ ${pc.magenta(formatBytes(this.lastAverageSpeed))}/s `;
        message += etaSpeedPart;
      }
    } else {
      // Use lastAverageSpeed for the case without total size as well
      message = `${message} (${pc.green(formatBytes(currentBytes))} downloaded @ ${pc.magenta(formatBytes(this.lastAverageSpeed))}/s) `;
    }
    // Always update the spinner message with the latest progress and potentially stale ETA/speed
    this.s.message(message);
  }

  message(message: string) {
    this.s.message(message);
  }

  stop(message: string, code?: number) {
    this.s.stop(message, code);
  }
}
