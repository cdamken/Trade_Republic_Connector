/**
 * Logging Utility
 *
 * Centralized logging for the Trade Republic connector
 */

import winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private winston: winston.Logger;

  constructor() {
    this.winston = winston.createLogger({
      level: process.env.TR_LOG_LEVEL ?? 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'trade-republic-connector' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaString}`;
            })
          ),
        }),
      ],
    });

    // Add file transport if log file is specified
    if (process.env.TR_LOG_FILE) {
      this.winston.add(
        new winston.transports.File({
          filename: process.env.TR_LOG_FILE,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        })
      );
    }
  }

  public debug(message: string, meta?: unknown): void {
    this.winston.debug(message, meta);
  }

  public info(message: string, meta?: unknown): void {
    this.winston.info(message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.winston.warn(message, meta);
  }

  public error(message: string, meta?: unknown): void {
    this.winston.error(message, meta);
  }

  public setLevel(level: LogLevel): void {
    this.winston.level = level;
  }

  public addFileTransport(filename: string): void {
    this.winston.add(
      new winston.transports.File({
        filename,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      })
    );
  }
}

// Export singleton instance
export const logger = new Logger();
