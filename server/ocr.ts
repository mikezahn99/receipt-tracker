/**
 * OCR Parsing Utilities
 *
 * This module handles:
 *  1. Calling Google Cloud Vision OCR to extract text from a receipt image.
 *  2. Parsing the raw OCR text to extract structured fields:
 *     - Purchase date
 *     - Merchant name
 *     - Total cost
 *     - Whether it's a fuel receipt
 *     - Gallons (if fuel)
 *
 * ─── GOOGLE CLOUD VISION SETUP ───
 * You need a Google Cloud project with the Vision API enabled.
 * Set the environment variable:
 *   GOOGLE_CLOUD_API_KEY=your-api-key-here
 *
 * The API key approach is the simplest.  Alternatively you can use a
 * service-account JSON file and set GOOGLE_APPLICATION_CREDENTIALS — see
 * the README for details.
 */

import fs from "fs";
import path from "path";

// ────────────────────────────────────────────
// 1. Call Google Cloud Vision OCR
// ────────────────────────────────────────────

/**
 * Sends an image to Google Cloud Vision and returns the full extracted text.
 * Uses the REST API with an API key (no SDK needed).
 *
 * @param imagePath – absolute path to the image file on disk
 * @returns the raw OCR text string (or empty string on failure)
 */
export async function extractTextFromImage(imagePath: string): Promise<string> {
  // ── INSERT YOUR GOOGLE CLOUD VISION API KEY HERE ──
  // You can set it via the environment variable GOOGLE_CLOUD_API_KEY
  // or hardcode it below for quick testing (not recommended for production).
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;

  if (!apiKey) {
    console.warn(
      "[OCR] GOOGLE_CLOUD_API_KEY is not set. Skipping OCR. " +
        "See README.md for setup instructions."
    );
    return "";
  }

  // Read the image file and encode it as base64 for the Vision API request
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  // Vision API endpoint with API key authentication
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const requestBody = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OCR] Vision API error:", response.status, errorText);
      return "";
    }

    const data = await response.json();

    // The first annotation in fullTextAnnotation contains all recognized text
    const fullText =
      data.responses?.[0]?.fullTextAnnotation?.text ??
      data.responses?.[0]?.textAnnotations?.[0]?.description ??
      "";

    return fullText;
  } catch (err) {
    console.error("[OCR] Failed to call Vision API:", err);
    return "";
  }
}

// ────────────────────────────────────────────
// 2. Parse structured fields from raw OCR text
// ────────────────────────────────────────────

export interface ParsedReceipt {
  merchant: string | null;
  purchaseDate: string | null; // YYYY-MM-DD
  total: number | null;
  category: "Fuel" | "Other";
  gallons: number | null;
  rawOcrText: string;
}

/**
 * Attempts to infer structured receipt data from raw OCR text.
 *
 * Parsing is best-effort — OCR text is messy and varies wildly
 * between receipt printers. The user always reviews and edits
 * before saving.
 */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText.split("\n").map((l) => l.trim());

  return {
    merchant: inferMerchant(lines),
    purchaseDate: inferDate(rawText),
    total: inferTotal(lines),
    category: isFuelReceipt(rawText) ? "Fuel" : "Other",
    gallons: inferGallons(rawText),
    rawOcrText: rawText,
  };
}

// ── Merchant ────────────────────────────────
/**
 * Heuristic: the merchant name is usually one of the first non-empty
 * lines on the receipt (often the very first line, or the first line
 * that looks like a business name — all caps, or contains certain chars).
 */
function inferMerchant(lines: string[]): string | null {
  // Walk the first 5 non-empty lines and pick the first one that
  // looks like a merchant name (>2 chars, not a date, not a phone number).
  const candidates = lines
    .filter((l) => l.length > 2)
    .slice(0, 5);

  for (const line of candidates) {
    // Skip lines that look like dates or phone numbers
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(line)) continue;
    if (/^\(?\d{3}\)?\s*[\-\.]?\s*\d{3}/.test(line)) continue;
    // Skip lines that are just numbers (zip codes, store numbers)
    if (/^\d+$/.test(line)) continue;
    return line;
  }
  return null;
}

// ── Date ────────────────────────────────────
/**
 * Looks for common US date patterns in the text:
 *   MM/DD/YYYY, MM-DD-YYYY, MM/DD/YY, MM-DD-YY
 *   Also handles YYYY-MM-DD (ISO) and month-name formats.
 */
function inferDate(text: string): string | null {
  // Pattern 1: MM/DD/YYYY or MM-DD-YYYY (with 2 or 4-digit year)
  const mdyMatch = text.match(
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/
  );
  if (mdyMatch) {
    let [, month, day, year] = mdyMatch;
    // If year is 2 digits, assume 2000s
    if (year.length === 2) year = "20" + year;
    const m = month.padStart(2, "0");
    const d = day.padStart(2, "0");
    // Basic sanity: month <= 12, day <= 31
    if (parseInt(m) <= 12 && parseInt(d) <= 31) {
      return `${year}-${m}-${d}`;
    }
  }

  // Pattern 2: ISO date YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }

  // Pattern 3: Month name formats like "Mar 21, 2026" or "March 21 2026"
  const monthNames =
    "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|" +
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const monthNameRegex = new RegExp(
    `(${monthNames})\\s+(\\d{1,2}),?\\s*(\\d{4})`,
    "i"
  );
  const nameMatch = text.match(monthNameRegex);
  if (nameMatch) {
    const monthStr = nameMatch[1].toLowerCase().slice(0, 3);
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const m = monthMap[monthStr];
    const d = nameMatch[2].padStart(2, "0");
    const y = nameMatch[3];
    if (m) return `${y}-${m}-${d}`;
  }

  return null;
}

// ── Total cost ──────────────────────────────
/**
 * Scans lines for keywords like "total", "amount", "balance due", "amount due",
 * then extracts the first dollar amount on that line.
 * Falls back to the largest dollar amount found on any line.
 */
function inferTotal(lines: string[]): number | null {
  const totalKeywords = /\b(total|amount\s*due|balance\s*due|grand\s*total|amount)\b/i;
  // We want to avoid picking up "sub total" or "subtotal"
  const subtotalKeywords = /\b(sub\s*total|subtotal|tax|tip)\b/i;

  let bestTotal: number | null = null;

  for (const line of lines) {
    if (totalKeywords.test(line) && !subtotalKeywords.test(line)) {
      const amount = extractDollarAmount(line);
      if (amount !== null) {
        // Prefer the last "total" line we find (often the grand total is last)
        bestTotal = amount;
      }
    }
  }

  // Fallback: if we didn't find a labeled total, look for the largest dollar amount
  if (bestTotal === null) {
    let maxAmount = 0;
    for (const line of lines) {
      const amount = extractDollarAmount(line);
      if (amount !== null && amount > maxAmount) {
        maxAmount = amount;
      }
    }
    if (maxAmount > 0) bestTotal = maxAmount;
  }

  return bestTotal;
}

/**
 * Extracts a dollar amount from a string.
 * Handles formats like "$12.34", "12.34", "$1,234.56"
 */
function extractDollarAmount(text: string): number | null {
  const match = text.match(/\$?\s*([\d,]+\.\d{2})/);
  if (match) {
    const cleaned = match[1].replace(/,/g, "");
    const value = parseFloat(cleaned);
    if (!isNaN(value) && value > 0) return value;
  }
  return null;
}

// ── Fuel detection ──────────────────────────
/**
 * Checks whether the OCR text contains fuel-related keywords.
 * This is a simple keyword scan — if any fuel word appears,
 * we flag it as a probable fuel receipt.
 */
function isFuelReceipt(text: string): boolean {
  const fuelKeywords =
    /\b(gas|gasoline|fuel|diesel|unleaded|premium|regular\s*unleaded|super|midgrade|gallons?|gal)\b/i;
  return fuelKeywords.test(text);
}

// ── Gallons extraction ──────────────────────
/**
 * Extracts gallons from patterns like:
 *   "12.345 GAL", "12.345 gallons", "Gallons: 12.345"
 *   Also handles "Volume: XX.XXX"
 */
function inferGallons(text: string): number | null {
  // Pattern 1: number followed by "gal" or "gallons"
  const galMatch = text.match(/([\d]+\.[\d]+)\s*(?:gal(?:lons?)?)/i);
  if (galMatch) {
    const value = parseFloat(galMatch[1]);
    if (!isNaN(value) && value > 0) return value;
  }

  // Pattern 2: "Gallons:" or "Volume:" followed by a number
  const labelMatch = text.match(/(?:gallons?|volume)\s*[:=]\s*([\d]+\.[\d]+)/i);
  if (labelMatch) {
    const value = parseFloat(labelMatch[1]);
    if (!isNaN(value) && value > 0) return value;
  }

  return null;
}
