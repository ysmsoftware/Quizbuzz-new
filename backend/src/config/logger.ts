import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { StreamOptions } from "morgan";
import { config } from "../config/index";
const { combine, timestamp, errors, json, printf, colorize } = winston.format;

const isProd = config.app.nodeEnv === "production";

// ── Formats ────────────────────────────────────────────────────────────────────

const devFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const fileFormat = combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json()
);

// ── Transports ─────────────────────────────────────────────────────────────────

const consoleTransport = new winston.transports.Console({
    format: isProd
        ? combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true }), json())
        : combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), errors({ stack: true }), devFormat),
});

// errors only — kept 14 days, max 20 MB/file, gzipped on rotation
const errorFileTransport = new DailyRotateFile({
    filename:      "logs/error-%DATE%.log",
    datePattern:   "YYYY-MM-DD",
    level:         "error",
    maxSize:       "20m",
    maxFiles:      "14d",
    zippedArchive: true,
    format:        fileFormat,
});

// all levels — kept 14 days, max 20 MB/file, gzipped on rotation
const combinedFileTransport = new DailyRotateFile({
    filename:      "logs/combined-%DATE%.log",
    datePattern:   "YYYY-MM-DD",
    maxSize:       "20m",
    maxFiles:      "14d",
    zippedArchive: true,
    format:        fileFormat,
});

// ── Logger ─────────────────────────────────────────────────────────────────────

const logger = winston.createLogger({
    level: isProd ? "info" : "debug",
    format: combine(
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errors({ stack: true }),
        isProd ? json() : devFormat,
    ),
    transports: [
        consoleTransport,
        errorFileTransport,
        combinedFileTransport,
    ],
    exitOnError: false,
});

export const morganStream: StreamOptions = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};

export default logger;
