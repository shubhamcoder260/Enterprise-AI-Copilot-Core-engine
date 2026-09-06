import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import {
  uploadDatabase,
  getActiveDatabase,
  switchActiveDatabase
} from "../controllers/database.controller.js";

const router = express.Router();

router.get("/active", getActiveDatabase);
router.post("/switch", switchActiveDatabase);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(
      null,
      path.join(__dirname, "../../uploads")
    );
  },

  filename: (req, file, cb) => {

    const uniqueName =
      Date.now() +
      "-" +
      file.originalname.replace(/\s+/g, "_");

    cb(null, uniqueName);
  }
});


const fileFilter = (req, file, cb) => {

  const allowedExtensions = [
    ".db",
    ".sqlite",
    ".sqlite3"
  ];

  const extension =
    path.extname(file.originalname)
      .toLowerCase();

  if (allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {

    cb(
      new Error(
        "Only SQLite database files are allowed."
      ),
      false
    );
  }
};


const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 50 * 1024 * 1024
  }
});


router.post(
  "/upload",
  upload.single("database"),
  uploadDatabase
);


export default router;