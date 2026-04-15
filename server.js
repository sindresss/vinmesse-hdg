const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.RENDER ? "/data" : __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Read error:", e);
  }
  return { _v: 0 };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf-8");
}

app.get("/api/data", (req, res) => {
  const data = readData();
  res.json(data);
});

app.post("/api/data", (req, res) => {
  const current = readData();
  const incoming = req.body;
  const merged = { ...current, ...incoming, _v: Date.now() };
  writeData(merged);
  res.json(merged);
});

app.delete("/api/data", (req, res) => {
  const empty = { _v: Date.now() };
  writeData(empty);
  res.json(empty);
});

app.listen(PORT, () => {
  console.log("Vinmesse HDG running on port " + PORT);
});
