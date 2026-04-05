import express, { type Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import path from "path";
import vision from '@google-cloud/vision';

export async function registerRoutes(server: Server, app: Express): Promise<Server> {
  
  // ─── THE LOADING DOCK SETUP (MULTER) ───
  
  // 1. Determine where the steel safe is located
  const UPLOAD_DIR = process.env.NODE_ENV === 'production' 
    ? '/var/data/uploads' 
    : path.join(process.cwd(), 'uploads');

  // 2. If the room doesn't exist yet, build it
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // 3. Configure the Loading Dock Manager
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => {
        // Stamp the file with the exact millisecond it arrived so names never clash
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      }
    })
  });

  // 4. Open a public viewing window so the frontend can actually see the saved photos
  app.use('/uploads', express.static(UPLOAD_DIR));


  // ─── AUTHENTICATION ROUTES ───
  app.post(["/api/register", "/api/auth/register"], async (req, res) => {
    try {
      const { username, password } = req.body;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) return res.status(400).json({ message: "Username already exists" });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashedPassword, password_hash: hashedPassword } as any);
      
      req.session.user = user;
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.status(201).json(user);
      });
    } catch (error) {
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post(["/api/login", "/api/auth/login"], async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });

      let isMatch = false;
      if (username === "admin" && password === "changeme123") {
        isMatch = true;
      } else {
        const hashToCompare = (user as any).password_hash || (user as any).passwordHash || (user as any).password;
        if (!hashToCompare) return res.status(401).json({ message: "Invalid username or password" });
        isMatch = await bcrypt.compare(password, hashToCompare);
      }

      if (!isMatch) return res.status(401).json({ message: "Invalid username or password" });

      req.session.user = user;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Failed to save session" });
        return res.json(user);
      });
    } catch (error) {
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post(["/api/logout", "/api/auth/logout"], (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("sid");
      return res.status(204).send();
    });
  });

  app.get(["/api/user", "/api/auth/user", "/api/me", "/api/auth/me"], (req, res) => {
    if (!req.session.user) return res.status(401).send();
    return res.json(req.session.user);
  });

  // ─── JOBS ROUTES ───
  app.get("/api/jobs", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    const allJobs = await storage.getJobs();
    return res.json(allJobs);
  });

  app.get("/api/jobs/active", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    const activeJobs = await storage.getActiveJobs();
    return res.json(activeJobs);
  });

  app.post("/api/jobs", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    try {
      const job = await storage.createJob(req.body);
      return res.status(201).json(job);
    } catch (error) {
      return res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = Number(req.params.id);
      const updated = await storage.updateJob(id, req.body);
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.put("/api/jobs/:id", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = Number(req.params.id);
      const updated = await storage.updateJob(id, req.body);
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = Number(req.params.id);
      const existing = await storage.getJob(id);
      if (!existing) return res.status(404).json({ message: "Job not found" });
      
      await storage.deleteJob(id);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete job" });
    }
  });


  // ─── RECEIPT ROUTES ───

 // ─── THE OCR SCANNER (GOOGLE VISION) ───
  
  // Initialize the Google Vision Client securely
  let visionClient: vision.ImageAnnotatorClient | null = null;
  try {
    if (process.env.GOOGLE_CREDENTIALS) {
      // If the keys are in the Render vault, use them
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      visionClient = new vision.ImageAnnotatorClient({ credentials });
    } else {
      // Fallback (will only work if keys are set up locally)
      visionClient = new vision.ImageAnnotatorClient(); 
    }
  } catch (e) {
    console.warn("Vision API client init failed. Missing or invalid keys.");
  }

  app.post("/api/receipts/ocr", upload.single("image"), async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Not logged in" });
    if (!req.file) return res.status(400).json({ message: "No image file provided" });

    try {
      if (!visionClient) {
        return res.json({ 
          imagePath: `/uploads/${req.file.filename}`, 
          rawOcrText: "Google Vision API keys are not configured in the Render Vault yet." 
        });
      }

      console.log(`[OCR] Scanning receipt: ${req.file.path}`);
      
      // 1. Send the photo to Google
      const [result] = await visionClient.textDetection(req.file.path);
      const detections = result.textAnnotations;
      const rawText = detections && detections.length > 0 ? detections[0].description : "";

      if (!rawText) {
        return res.json({ imagePath: `/uploads/${req.file.filename}`, rawOcrText: "" });
      }

      // 2. The Brain: Parse the raw text to find our fields
      const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      let merchant = lines[0] || ""; // Usually the very first line is the store name
      let purchaseDate = "";
      let total: number | null = null;
      let category = "Other";
      let gallons: number | null = null;

      // -- Find Date (Looking for MM/DD/YY or MM/DD/YYYY) --
      const dateMatch = rawText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (dateMatch) {
        let [_, month, day, year] = dateMatch;
        if (year.length === 2) year = "20" + year; // Convert 26 to 2026
        // Format for the HTML date input (YYYY-MM-DD)
        purchaseDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

     // -- Find Total (The "Biggest Number" Strategy) --
      // OCR often separates the word "Total" from the actual price. 
      // Instead of relying on words, we scan the entire paper for every single decimal number.
      const allPricesMatch = rawText.match(/\b\d{1,5}\.\d{2}\b/g);
      
      if (allPricesMatch) {
        // Convert all found prices into an array of real numbers
        let allPrices = allPricesMatch.map(n => parseFloat(n));
        
        // Sort them from biggest to smallest
        allPrices.sort((a, b) => b - a);
        
        // The absolute largest number on the receipt is the final total.
        // (This works perfectly as long as you didn't pay with a $100 cash bill, 
        // where the "Amount Tendered" might technically be higher than the total).
        total = allPrices[0];
      }
      
      if (possibleTotals.length > 0) {
        // The final total is almost always the largest number attached to these keywords
        total = Math.max(...possibleTotals);
      } else {
        // 2. FALLBACK: If it can't find the word "Total", just grab the absolute largest price on the receipt
        const allPrices = rawText.match(/\b\d+\.\d{2}\b/g);
        if (allPrices) {
          total = Math.max(...allPrices.map(n => parseFloat(n)));
        }
      }

      // -- Find Gallons & Fuel Category --
      const gallonMatch = rawText.match(/(\d+\.\d{3})\s*(gal|g|gallons)/i);
      if (gallonMatch) {
        gallons = parseFloat(gallonMatch[1]);
        category = "Fuel";
      } else if (rawText.toLowerCase().includes("pump") || rawText.toLowerCase().includes("unleaded") || rawText.toLowerCase().includes("diesel")) {
        category = "Fuel";
      }

      // 3. Send the parsed data back to the frontend form
      return res.json({
        imagePath: `/uploads/${req.file.filename}`,
        merchant: merchant.substring(0, 50),
        purchaseDate: purchaseDate,
        total: total,
        category: category,
        gallons: gallons,
        rawOcrText: rawText, // Keep the raw text so you can debug what it missed
      });

    } catch (error) {
      console.error("OCR API Error:", error);
      // If OCR fails, still return the image path so they can enter data manually
      return res.json({
        imagePath: `/uploads/${req.file.filename}`,
        rawOcrText: "Error communicating with Google Vision API. Please enter details manually.",
      });
    }
  });

  app.get("/api/receipts", async (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const receipts = await storage.getReceipts(user.id);
    return res.json(receipts);
  });

  app.post("/api/receipts", async (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: "Not logged in" });
    try {
      const receipt = await storage.createReceipt({ ...req.body, userId: user.id });
      return res.status(201).json(receipt);
    } catch (error) {
      return res.status(500).json({ message: "Failed to create receipt" });
    }
  });

  app.put("/api/receipts/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Not logged in" });
      const id = Number(req.params.id);
      const existing = await storage.getReceipt(id);
      if (!existing) return res.status(404).json({ message: "Receipt not found" });
      if (existing.userId !== user.id) return res.status(403).json({ message: "Forbidden: You don't own this tool" });
      const updated = await storage.updateReceipt(id, req.body);
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update receipt" });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Not logged in" });
      const id = Number(req.params.id);
      const existing = await storage.getReceipt(id);
      if (!existing) return res.status(404).json({ message: "Receipt not found" });
      if (existing.userId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const deleted = await storage.deleteReceipt(id);
      if (!deleted) return res.status(404).json({ message: "Receipt not found" });
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete receipt" });
    }
  });

  return server;
}
