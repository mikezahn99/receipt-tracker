/**
 * API Routes for the Receipt Expense Tracker.
 *
 * Endpoints:
 *   POST   /api/receipts/ocr    – Upload an image, run OCR, return parsed fields
 *   GET    /api/receipts         – List receipts (with optional filters)
 *   POST   /api/receipts         – Save a new receipt
 *   GET    /api/jobs             – List all jobs
 *   GET    /api/jobs/active      – List active jobs only (for dropdown)
 *   POST   /api/jobs             – Create a new job
 *   PATCH  /api/jobs/:id         – Update a job (name, status)
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, seedDatabase } from "./storage";
import { insertReceiptSchema, insertJobSchema } from "@shared/schema";
import { extractTextFromImage, parseReceiptText } from "./ocr";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      role: string;
    };
  }
}

// ── File upload configuration ───────────────
// Uploaded receipt images are saved to ./uploads/
const dataDir = process.env.DATA_DIR || process.cwd();
const uploadsDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      // Use a timestamp + original name to avoid collisions
      const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Run seed data on startup (creates example jobs if table is empty)
  seedDatabase();

  // Serve uploaded images statically so the frontend can display them
  const express = await import("express");
  app.use("/uploads", express.default.static(uploadsDir));

  // ════════════════════════════════════════════
  // OCR ENDPOINT
  // ════════════════════════════════════════════

  /**
   * POST /api/receipts/ocr
   *
   * Accepts a multipart file upload (field name: "image").
   * Sends the image to Google Cloud Vision OCR, parses the text,
   * and returns the structured fields so the frontend can pre-fill the form.
   */
  app.post("/api/receipts/ocr", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const imagePath = req.file.path;
      const relativeImagePath = `/uploads/${req.file.filename}`;

      // Call Google Cloud Vision OCR
      const rawText = await extractTextFromImage(imagePath);

      // Parse the raw OCR text into structured receipt fields
      const parsed = parseReceiptText(rawText);

      return res.json({
        imagePath: relativeImagePath,
        merchant: parsed.merchant,
        purchaseDate: parsed.purchaseDate,
        total: parsed.total,
        category: parsed.category,
        gallons: parsed.gallons,
        rawOcrText: parsed.rawOcrText,
      });
    } catch (err: any) {
      console.error("[OCR] Error processing image:", err);
      return res.status(500).json({ message: err.message || "OCR processing failed" });
    }
  });
  
  // ════════════════════════════════════════════
  // AUTH ENDPOINTS
  // ════════════════════════════════════════════

  /** POST /api/auth/register – create a new user */
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const passwordHash = bcrypt.hashSync(password, 10);

      const user = await storage.createUser({
        username,
        passwordHash,
        role: "user",
      });

      return res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
      });
    } catch (err: any) {
      console.error("Register error:", err);
      return res.status(500).json({ message: "Failed to register user" });
    }
  });

  /** POST /api/auth/login – verify username/password */
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(400).json({ message: "Invalid username or password" });
      }

      const valid = bcrypt.compareSync(password, user.passwordHash);
      if (!valid) {
        return res.status(400).json({ message: "Invalid username or password" });
      }

    req.session.user = {
  id: user.id,
  username: user.username,
  role: user.role,
};

return res.json({
  id: user.id,
  username: user.username,
  role: user.role,
});
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Failed to login" });
    }
  });

  /** POST /api/auth/logout – placeholder until session middleware is added */
 app.post("/api/auth/logout", (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Failed to logout" });
    }

    res.clearCookie("connect.sid");
    return res.json({ success: true });
  });
});
    app.get("/api/auth/me", (req, res) => {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({ message: "Not logged in" });
    }

    return res.json(user);
  });
  
  // ════════════════════════════════════════════
  // RECEIPTS ENDPOINTS
  // ════════════════════════════════════════════

  /**
   * GET /api/receipts
   *
   * Returns all receipts, optionally filtered by query params:
   *   ?startDate=YYYY-MM-DD
   *   ?endDate=YYYY-MM-DD
   *   ?jobId=123
   *   ?category=Fuel  (or "Other")
   */
    app.get("/api/receipts", async (req, res) => {
    try {
      const user = req.session.user;

      if (!user) {
        return res.status(401).json({ message: "Not logged in" });
      }

      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        jobId: req.query.jobId ? parseInt(req.query.jobId as string) : undefined,
        category: req.query.category as string | undefined,
        userId: user.id,
      };

      const receipts = await storage.getReceipts(filters);
      return res.json(receipts);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  /**
   * POST /api/receipts
   *
   * Saves a new receipt entry. Body is JSON matching InsertReceipt.
   * Validates with Zod before saving.
   */
  app.post("/api/receipts", async (req, res) => {
    try {
      const user = req.session.user;

      if (!user) {
        return res.status(401).json({ message: "Not logged in" });
      }

      const parsed = insertReceiptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const receipt = await storage.createReceipt({
        ...parsed.data,
        userId: user.id,
      });

      return res.status(201).json(receipt);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ════════════════════════════════════════════
  // JOBS ENDPOINTS
  // ════════════════════════════════════════════

  /** GET /api/jobs – all jobs (for admin/management view) */
  app.get("/api/jobs", async (_req, res) => {
    try {
      const allJobs = await storage.getJobs();
      return res.json(allJobs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/jobs/active – only active jobs (for the receipt form dropdown) */
  app.get("/api/jobs/active", async (_req, res) => {
    try {
      const activeJobs = await storage.getActiveJobs();
      return res.json(activeJobs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/jobs – create a new job */
  app.post("/api/jobs", async (req, res) => {
    try {
      const parsed = insertJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const job = await storage.createJob(parsed.data);
      return res.status(201).json(job);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
    app.put("/api/receipts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);

      const {
        merchant,
        purchaseDate,
        total,
        category,
        gallons,
        jobId,
        notes,
      } = req.body;

      const updated = await storage.updateReceipt(id, {
        merchant,
        purchaseDate,
        total,
        category,
        gallons,
        jobId,
        notes,
      });

      if (!updated) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating receipt:", error);
      res.status(500).json({ message: "Failed to update receipt" });
    }
  });
  app.delete("/api/receipts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const deleted = await storage.deleteReceipt(id);

    if (!deleted) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Delete receipt error:", error);
    return res.status(500).json({ message: "Failed to delete receipt" });
  }
});
  /** PATCH /api/jobs/:id – update job name or status */
  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      const updated = await storage.updateJob(id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Job not found" });
      }
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
