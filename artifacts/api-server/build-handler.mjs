/**
 * Builds the Express app as a Vercel serverless handler.
 * Outputs to <repo-root>/api/index.js (CommonJS for maximum Vercel compatibility)
 */
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const apiDir = path.resolve(repoRoot, "api");

await rm(apiDir, { recursive: true, force: true });
await mkdir(apiDir, { recursive: true });

await esbuild({
  entryPoints: { index: path.resolve(__dirname, "src/app.ts") },
  platform: "node",
  bundle: true,
  format: "cjs",
  outdir: apiDir,
  logLevel: "info",
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "pg-native",
    "oracledb",
    "mysql2",
    "mongodb-client-encryption",
    "nodemailer",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@prisma/client",
    "@mikro-orm/*",
    "@grpc/*",
    "@swc/*",
    "@aws-sdk/*",
    "@azure/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "googleapis",
    "firebase-admin",
    "@parcel/watcher",
    "@sentry/profiling-node",
    "aws-sdk",
    "dd-trace",
    "miniflare",
    "piscina",
    "sequelize",
    "snappy",
    "workerd",
    "wrangler",
    "zeromq",
    "playwright",
    "puppeteer",
    "electron",
  ],
  sourcemap: false,
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  // Ensure the Express app is accessible as module.exports for Vercel
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

console.log("Handler built → api/index.js (CJS)");
