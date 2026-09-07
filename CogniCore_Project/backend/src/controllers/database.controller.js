import fs from "fs/promises";
import {
  switchDatabase,
  getActiveDatabasePath
} from "../config/database.js";

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
    if (!databasePath) {
      return res.status(400).json({ success: false, message: "Missing databasePath in request body." });
    }
    await switchDatabase(databasePath);
    return res.status(200).json({
      success: true,
      activeDatabase: getActiveDatabasePath()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}