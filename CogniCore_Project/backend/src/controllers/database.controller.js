import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  switchDatabase,
  getActiveDatabasePath
} from "../config/database.js";
import { switchTo, getActiveSource } from "../kernel/switch.orchestrator.js";
import { getRegisteredSources, getSourceById } from "../config/sources.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function uploadDatabase(req, res) {

  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No database file uploaded."
      });
    }

    const uploadedPath = req.file.path;

    // Verify SQLite format 3 magic header
    try {
      const handle = await fs.open(uploadedPath, "r");
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, 16, 0);
      await handle.close();
      const header = buffer.toString("utf8", 0, 15);
      if (header !== "SQLite format 3") {
        await fs.unlink(uploadedPath).catch(() => {});
        return res.status(400).json({
          success: false,
          message: "The uploaded file is not a valid SQLite database."
        });
      }
    } catch (readErr) {
      await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({
        success: false,
        message: "Failed to read uploaded database file: " + readErr.message
      });
    }

    console.log(
      "📁 Database uploaded and verified:",
      uploadedPath
    );

    await switchDatabase(uploadedPath);

    console.log(
      "✅ ACTIVE DATABASE IS NOW:",
      getActiveDatabasePath()
    );

    return res.status(200).json({
      success: true,
      message:
        "Database uploaded and activated successfully.",

      activeDatabase:
        getActiveDatabasePath(),

      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size
      }
    });

  } catch (error) {

    console.error(
      "❌ Database upload error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to upload and activate database.",
      error: error.message
    });
  }
}

export async function getActiveDatabase(req, res) {
  try {
    return res.status(200).json({
      success: true,
      activeDatabase: getActiveDatabasePath()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function switchActiveDatabase(req, res) {
  try {
    const { databasePath } = req.body || {};
    if (!databasePath || typeof databasePath !== "string") {
      return res.status(400).json({ success: false, message: "Missing databasePath in request body." });
    }

    // Path sanitization & traversal defense (VULN-01)
    if (databasePath.includes("..")) {
      return res.status(403).json({
        error: "path_not_allowed",
        message: "Path cannot contain directory traversal elements (..)."
      });
    }

    const forbiddenExtensions = [".enc", ".log", ".json", ".db.bak"];
    if (forbiddenExtensions.some((ext) => databasePath.toLowerCase().endsWith(ext))) {
      return res.status(403).json({
        error: "path_not_allowed",
        message: "Access to internal artifacts or encrypted files is forbidden."
      });
    }

    const resolvedPath = path.resolve(databasePath);
    const allowedDirs = [
      path.resolve(__dirname, "../../uploads"),
      path.resolve(__dirname, "../../fixtures"),
      path.resolve(__dirname, "../../test/fixtures")
    ];

    const isAllowed = allowedDirs.some((dir) => resolvedPath.startsWith(dir));
    if (!isAllowed) {
      return res.status(403).json({
        error: "path_not_allowed",
        message: "Requested database file is outside allowed directories.",
        allowedDirectories: allowedDirs
      });
    }

    await switchDatabase(resolvedPath);
    await switchTo({
      id: "sqlite_default",
      kind: "sqlite",
      dialect: "sqlite",
      path: resolvedPath
    });
    return res.status(200).json({
      success: true,
      activeDatabase: getActiveDatabasePath()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "internal_server_error", message: error.message });
  }
}

export async function listSources(req, res) {
  try {
    return res.status(200).json({
      success: true,
      activeSource: getActiveSource(),
      sources: getRegisteredSources()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function switchSource(req, res) {
  try {
    const { sourceId } = req.body || {};
    if (!sourceId) {
      return res.status(400).json({ success: false, message: "Missing sourceId in request body." });
    }
    const source = getSourceById(sourceId);
    if (!source) {
      return res.status(404).json({ success: false, message: `Source "${sourceId}" not found in registry.` });
    }

    if (source.dialect === "sqlite" && source.path) {
      await switchDatabase(source.path);
    }

    const newActive = await switchTo(source);
    return res.status(200).json({
      success: true,
      activeSource: newActive,
      message: `Active source switched to ${source.name || sourceId}`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}