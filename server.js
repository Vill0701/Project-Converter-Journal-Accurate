// server.js - FINAL MULTI-APP VERSION
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// 1. Izinkan akses ke semua folder
app.use(express.static(path.join(__dirname, ".")));

// 2. Setup Database
const db = new sqlite3.Database("./database_faktur.db", (err) => {
  if (err) console.error("Error DB:", err.message);
  else console.log("Terhubung ke database SQLite Multi-App.");
});

// 3. Buat Tabel Baru (Ada kolom category)
db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    filename TEXT,
    xml_content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 4. API Simpan
app.post("/api/save", (req, res) => {
  const { category, filename, xml_content } = req.body;
  const cat = category || "general";

  console.log(`Menyimpan data untuk kategori: ${cat}`); // Debug Log

  const sql = `INSERT INTO history (category, filename, xml_content) VALUES (?, ?, ?)`;
  db.run(sql, [cat, filename, xml_content], function (err) {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Berhasil disimpan!", id: this.lastID });
  });
});

// 5. API Ambil History
app.get("/api/history/:category", (req, res) => {
  const cat = req.params.category;
  console.log(`Mengambil history kategori: ${cat}`); // Debug Log

  const sql = `SELECT id, filename, created_at FROM history WHERE category = ? ORDER BY id DESC`;
  db.all(sql, [cat], (err, rows) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 6. API Download
app.get("/api/download/:id", (req, res) => {
  const sql = `SELECT xml_content FROM history WHERE id = ?`;
  db.get(sql, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "File tidak ditemukan" });
    res.json(row);
  });
});

app.listen(PORT, () => {
  console.log(`Server SIAP di http://localhost:${PORT}`);
});

// 7. Delete
app.delete("/api/history/:id", (req, res) => {
  const id = req.params.id;
  const sql = `DELETE FROM history WHERE id = ?`;

  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Berhasil dihapus", changes: this.changes });
  });
});
