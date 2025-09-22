"use strict";

/**
 * Complete, updated app.js for Passenger under /api/schedules
 * - Adds a "/" route (so hitting /api/schedules no longer 404s)
 * - Keeps dual mounting at "/" and BASE (BASE from PASSENGER_BASE_URI)
 * - Expands CORS to include knp.edu.ph
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import qs from "qs";
import {
  checkIpExists,
  upsertVisitor,
  touchByIp,
  authInfo,
} from "./googleSheets.js";

// Timezone
process.env.TZ = "Asia/Manila";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env (prefer server/.env, fallback to repo root .env)
const localEnv = path.resolve(__dirname, ".env");
const rootEnv = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(localEnv)) dotenv.config({ path: localEnv });
else if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Base path for mounting (Passenger base uri or custom)
const BASE = process.env.PASSENGER_BASE_URI || "/api/schedules";

// Basic hardening
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.set("etag", "strong");
app.set("query parser", (str) => qs.parse(str, { allowPrototypes: false }));
app.use(
  helmet({
    hsts: isProd ? undefined : false,
  })
);

// Request correlation + logging
morgan.token("id", (req) => req.id || "-");
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});
const logFormat = isProd
  ? ":id :remote-addr :method :url :status :res[content-length] - :response-time ms"
  : ":id :method :url :status :response-time ms";
app.use(morgan(logFormat));

// Body parsers
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://knp.edu.ph",
    "https://www.knp.edu.ph",
    "https://schedules.knp.edu.ph",
    "https://www.schedules.knp.edu.ph",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  credentials: true,
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Compression (skip already-compressed types)
app.use(
  compression({
    threshold: 2 * 1024,
    filter: (req, res) => {
      const type = String(res.getHeader("Content-Type") || "").toLowerCase();
      if (/^(image|video|audio)\//i.test(type)) return false;
      return compression.filter(req, res);
    },
  })
);

// Rate limit for writes
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Router with core endpoints
const router = express.Router();

const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
const sheetName = process.env.SHEETS_WORKSHEET_NAME || "Sheet1";

// Root route so /api/schedules returns something useful
router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({
    ok: true,
    base: BASE,
    endpoints: [`${BASE}/health`, `${BASE}/visitor`, `${BASE}/debug/auth`],
  });
});

router.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ ok: true, spreadsheetId: !!spreadsheetId, sheetName });
});
router.head("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(200).end();
});

router.get("/debug/auth", async (req, res) => {
  try {
    const info = await authInfo();
    res.json({ ok: true, ...info });
  } catch (e) {
    res.status(500).json({ ok: false, error: "auth_error" });
  }
});

router.get("/visitor", async (req, res) => {
  try {
    if (!spreadsheetId)
      return res
        .status(500)
        .json({ ok: false, error: "Missing spreadsheetId" });
    const ip = (req.query.ip || "").toString();
    const { exists } = await checkIpExists({ spreadsheetId, sheetName, ip });
    res.json({ exists });
  } catch (e) {
    console.error(`[${req.id}] GET /visitor error`, e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.post("/visitor", writeLimiter, async (req, res) => {
  try {
    if (!spreadsheetId)
      return res
        .status(500)
        .json({ ok: false, error: "Missing spreadsheetId" });
    const { name = "", role = "", ip = "", action = "" } = req.body || {};
    if (action === "touch") {
      const out = await touchByIp({ spreadsheetId, sheetName, ip });
      return res.json({ ok: true, ...out });
    }
    const out = await upsertVisitor({
      spreadsheetId,
      sheetName,
      name,
      role,
      ip,
    });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error(`[${req.id}] POST /visitor error`, e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Mount router at root and at BASE
app.use("/", router);
if (BASE !== "/") app.use(BASE, router);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${req.id || "-"}]`, err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

// Passenger vs standalone
let server;
try {
  // @ts-ignore
  if (typeof PhusionPassenger !== "undefined") {
    // @ts-ignore
    PhusionPassenger.configure({ autoInstall: false });
    // @ts-ignore
    server = app.listen("passenger", () => {
      console.log("Server running under Phusion Passenger");
    });
  } else {
    const port = process.env.PORT || 3000;
    server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
} catch {
  const port = process.env.PORT || 3000;
  server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// Graceful shutdown
const shutdown = async (signal) => {
  try {
    console.log(`Received ${signal}, shutting down...`);
    if (server) await new Promise((resolve) => server.close(resolve));
    process.exit(0);
  } catch (e) {
    console.error("Error during shutdown", e);
    process.exit(1);
  }
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
