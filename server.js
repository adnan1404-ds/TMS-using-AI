
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001; 
const DB_PATH = path.join(__dirname, 'transport.db');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db;

async function initializeDb() {
    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    const SYSTEM_TABLES = [
        'vehicles', 'drivers', 'attendance', 'overtime', 'fuel',
        'daily_reports', 'private_use', 'pol_prices',
        'school_duty', 'school_employees', 'job_orders',
        'spd_reporting', 'log_book', 'pol_utilized',
        'pol_exp_rs', 'pol_monthly', 'pol_rs', 'pol_report',
        'pol_state', 'pol_soi_entries', 'pol_soi_monthly',
        'routes', 'route_passengers', 'vehicle_duty_logs', 'driver_duty_logs',
        'app_schema'
    ];

    for (const key of SYSTEM_TABLES) {
        await db.exec(`CREATE TABLE IF NOT EXISTS "${key}" (id INTEGER PRIMARY KEY AUTOINCREMENT)`);
    }
    console.log("SQLite Database Fully Initialized at:", DB_PATH);
}

initializeDb().catch(err => console.error("DB Init Failed:", err));

async function ensureColumns(tableName, dataObject) {
    if (!dataObject) return;
    const columns = await db.all(`PRAGMA table_info("${tableName}")`);
    const existingColumns = columns.map(c => c.name);
    const newKeys = Object.keys(dataObject);
    for (const key of newKeys) {
        if (!existingColumns.includes(key) && key !== 'id') {
            const type = typeof dataObject[key] === 'number' ? 'REAL' : 'TEXT';
            try {
                await db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${key}" ${type}`);
                console.log(`Added column ${key} to ${tableName}`);
            } catch (e) {
                console.error(`Column error for ${key} in ${tableName}:`, e.message);
            }
        }
    }
}

app.get('/api/db', async (req, res) => {
    try {
        const fullDb = {};
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        for (const table of tables) {
            try {
                const rows = await db.all(`SELECT * FROM "${table.name}"`);
                fullDb[table.name] = rows;
            } catch (e) {}
        }
        res.json(fullDb);
    } catch (err) {
        res.status(500).send("Read error");
    }
});

app.post('/api/save/:section', async (req, res) => {
    const section = req.params.section;
    const newData = req.body;
    
    if (!Array.isArray(newData)) {
        return res.status(400).send("Invalid data format. Expected Array.");
    }

    try {
        await db.exec('BEGIN TRANSACTION');
        
        if (newData.length > 0) {
            // Merge all keys from all objects to ensure every potential column is created
            let allKeys = {};
            newData.forEach(item => { allKeys = { ...allKeys, ...item }; });
            
            await ensureColumns(section, allKeys);
            await db.exec(`DELETE FROM "${section}"`);
            
            const keys = Object.keys(allKeys).filter(k => k !== 'id');
            if (keys.length > 0) {
                const placeholders = keys.map(() => '?').join(',');
                const columns = keys.map(k => `"${k}"`).join(',');
                
                const stmt = await db.prepare(`INSERT INTO "${section}" (${columns}) VALUES (${placeholders})`);
                for (const row of newData) {
                    const values = keys.map(k => row[k] === undefined ? null : row[k]);
                    await stmt.run(values);
                }
                await stmt.finalize();
            }
        } else {
            await db.exec(`DELETE FROM "${section}"`);
        }
        
        await db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        try { await db.exec('ROLLBACK'); } catch (e) {}
        console.error(`Save Error in ${section}:`, err);
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => {
    console.log(`SQLite Persistence Server running at http://localhost:${PORT}`);
});
