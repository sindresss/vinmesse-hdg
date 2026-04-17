const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync("/data") ? "/data" : __dirname);
const DATA_FILE = path.join(DATA_DIR, "data.json");
const VALID_REACTIONS = new Set(["positive", "neutral", "negative"]);
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_COMMENT_LENGTH = 500;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

function getDefaultData() {
  return { _v: 0 };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeData(data) {
  const normalized = { _v: isPlainObject(data) && typeof data._v === "number" ? data._v : 0 };

  if (!isPlainObject(data)) {
    return normalized;
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "_v" || RESERVED_KEYS.has(key)) {
      continue;
    }

    if (typeof key !== "string" || key.length === 0 || key.length > 200) {
      continue;
    }

    if (key.endsWith("::comment")) {
      if (typeof value === "string") {
        const trimmed = value.trim();

        if (trimmed) {
          normalized[key] = trimmed.slice(0, MAX_COMMENT_LENGTH);
        }
      }

      continue;
    }

    if (VALID_REACTIONS.has(value)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function mergeData(currentData, incomingData) {
  const merged = { _v: Date.now() };

  for (const [key, value] of Object.entries(currentData)) {
    if (key !== "_v" && !RESERVED_KEYS.has(key)) {
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(incomingData)) {
    if (key !== "_v" && !RESERVED_KEYS.has(key)) {
      merged[key] = value;
    }
  }

  return normalizeData(merged);
}

function readData() {
  try {
    ensureDataDir();

    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      return normalizeData(parsed);
    }
  } catch (error) {
    console.error("Failed to read data file:", error);
  }

  return getDefaultData();
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

app.get("/healthz", function (_req, res) {
  res.json({ ok: true });
});

app.get("/api/data", function (_req, res) {
  res.set("Cache-Control", "no-store");
  res.json(readData());
});

app.post("/api/data", function (req, res) {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: "Body must be a JSON object." });
  }

  const currentData = readData();
  const mergedData = mergeData(currentData, req.body);

  try {
    writeData(mergedData);
    return res.json(mergedData);
  } catch (error) {
    console.error("Failed to write data file:", error);
    return res.status(500).json({ error: "Failed to save data." });
  }
});

app.delete("/api/data", function (_req, res) {
  const emptyData = { _v: Date.now() };

  try {
    writeData(emptyData);
    return res.json(emptyData);
  } catch (error) {
    console.error("Failed to reset data file:", error);
    return res.status(500).json({ error: "Failed to reset data." });
  }
});

app.listen(PORT, function () {
  console.log("Running on port " + PORT);
});
