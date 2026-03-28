import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";

// We changed the "Contract" here to accept (server, app) to match your index.ts
export async function registerRoutes(server: Server, app: Express): Promise<Server> {
  
  // --- AUTHENTICATION ROUTES ---

  app.post("/api/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createUser({ username, password });
      req.session.user = user;
      return res.status(201).json(user);
    } catch (error) {
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.session.user = user;
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("sid");
      return res.status(204).send();
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.session.user) return res.status(401).send();
    return res.json(req.session.user);
  });

  // --- RECEIPT ROUTES ---

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
      const receipt = await storage.createReceipt({
        ...req.body,
        userId: user.id,
      });
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

      if (!existing) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      if (existing.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden: You don't own this tool" });
      }

      const updated = await storage.updateReceipt(id, req.body);
      return res.json(updated);
    } catch (error) {
      console.error("Error updating receipt:", error);
      return res.status(500).json({ message: "Failed to update receipt" });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Not logged in" });

      const id = Number(req.params.id);
      const existing = await storage.getReceipt(id);

      if (!existing) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      if (existing.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden: You can't scrap someone else's tools" });
      }

      const deleted = await storage.deleteReceipt(id);
      if (!deleted) return res.status(404).json({ message: "Receipt not found" });

      return res.status(204).send();
    } catch (error) {
      console.error("Delete receipt error:", error);
      return res.status(500).json({ message: "Failed to delete receipt" });
    }
  });

  // Return the existing server back to the dispatcher
  return server;
}
