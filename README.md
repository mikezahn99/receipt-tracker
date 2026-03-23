# Expense Tracker — Receipt Manager

A self-hosted web application for tracking work expenses from receipts. Upload or photograph a receipt, and the app uses **Google Cloud Vision OCR** to automatically extract merchant, date, total, and fuel information. Review the data, assign it to a job, and save.

Built with React + TypeScript (Vite) on the frontend and Node.js + Express + SQLite on the backend. No vendor lock-in — you fully own the code and data.

---

## Features

- **Receipt photo upload** — upload from desktop or capture via phone camera
- **OCR text extraction** — Google Cloud Vision reads the receipt and pre-fills fields
- **Fuel detection** — automatically detects gas/diesel receipts and prompts for gallons
- **Job assignment** — every receipt is assigned to a job from a managed list
- **Filterable table view** — filter receipts by date range, job, or category (Fuel / Other)
- **Jobs management** — create jobs, toggle Active/Inactive status
- **Mobile-friendly** — responsive layout with collapsible sidebar
- **SQLite database** — zero-config, file-based storage (no separate DB server needed)

---

## Prerequisites

- **Node.js 18+** (tested with Node 20)
- **npm** (comes with Node.js)
- A **Google Cloud** account (for OCR — the app works without it, but OCR will be disabled)

---

## Step 1: Google Cloud Vision API Setup

To enable automatic receipt scanning, you need a Google Cloud project with the Vision API enabled.

### 1.1 Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., "Receipt Tracker") and click **Create**

### 1.2 Enable the Vision API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for **"Cloud Vision API"**
3. Click on it and click **Enable**

### 1.3 Create an API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **API Key**
3. Copy the key — you'll use it in the next step
4. (Recommended) Click **Restrict Key** and limit it to the **Cloud Vision API**

### 1.4 Alternative: Service Account (optional)

If you prefer service account authentication instead of an API key:

1. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **Service Account**
2. Download the JSON key file
3. Set the environment variable: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-key.json`

> **Note:** The current code uses the API key approach. To use a service account instead, you'd need to swap the REST call in `server/ocr.ts` with the `@google-cloud/vision` npm package. The code has comments showing where to make this change.

---

## Step 2: Environment Variables

Create a `.env` file in the project root (or set these variables in your shell):

```bash
# Required for OCR functionality
GOOGLE_CLOUD_API_KEY=your-google-cloud-vision-api-key-here

# Optional: change the port (default is 5000)
PORT=5000
```

> **Without the API key**, the app still works — you just won't get automatic text extraction from receipt photos. You can enter all fields manually.

---

## Step 3: Install Dependencies

```bash
cd receipt-tracker
npm install
```

---

## Step 4: Initialize the Database

The database is created automatically on first run. The app uses SQLite (`data.db` in the project root) with Drizzle ORM.

If you want to explicitly push the schema:

```bash
npx drizzle-kit push
```

On first startup, the server automatically seeds 5 example jobs. You can modify the seed data in `server/storage.ts` (look for the `seedDatabase()` function).

---

## Step 5: Run the Development Server

```bash
npm run dev
```

This starts both the Express backend and Vite frontend on a single port (default: `http://localhost:5000`).

Open your browser to `http://localhost:5000`.

---

## Step 6: Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

To run the production server:

```bash
NODE_ENV=production node dist/index.cjs
```

Or use the npm script:

```bash
npm start
```

### Running with a Process Manager (recommended)

For a reliable self-hosted deployment, use PM2:

```bash
npm install -g pm2
npm run build
pm2 start dist/index.cjs --name receipt-tracker
pm2 save
pm2 startup  # generates a command to run on system boot
```

---

## Project Structure

```
receipt-tracker/
├── client/                    # Frontend (React + TypeScript + Vite)
│   ├── index.html             # HTML entry point
│   └── src/
│       ├── App.tsx            # Router and app shell
│       ├── index.css          # Tailwind CSS + theme variables
│       ├── main.tsx           # React entry point
│       ├── components/
│       │   └── AppLayout.tsx  # Sidebar navigation layout
│       ├── pages/
│       │   ├── receipts.tsx   # Receipts list with filters
│       │   ├── new-receipt.tsx # New receipt form with OCR upload
│       │   ├── jobs.tsx       # Jobs management page
│       │   └── not-found.tsx  # 404 page
│       └── lib/
│           └── queryClient.ts # TanStack Query + API helpers
│
├── server/                    # Backend (Express + TypeScript)
│   ├── index.ts               # Server entry point
│   ├── routes.ts              # API route handlers
│   ├── storage.ts             # Database operations + seed data
│   ├── ocr.ts                 # Google Cloud Vision integration + text parsing
│   ├── vite.ts                # Vite dev server integration
│   └── static.ts              # Static file serving for production
│
├── shared/                    # Shared between frontend & backend
│   └── schema.ts              # Database schema + Zod validation
│
├── uploads/                   # Uploaded receipt images (created at runtime)
├── data.db                    # SQLite database (created at runtime)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── drizzle.config.ts
└── README.md
```

---

## API Endpoints

### Receipts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/receipts` | List all receipts (optional filters: `startDate`, `endDate`, `jobId`, `category`) |
| `POST` | `/api/receipts` | Save a new receipt (JSON body) |
| `POST` | `/api/receipts/ocr` | Upload an image for OCR processing (multipart form, field: `image`) |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/jobs` | List all jobs |
| `GET` | `/api/jobs/active` | List only active jobs |
| `POST` | `/api/jobs` | Create a new job |
| `PATCH` | `/api/jobs/:id` | Update a job (name, status) |

---

## Database Schema

### Jobs Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `job_name` | TEXT | Name of the job/project |
| `status` | TEXT | "Active" or "Inactive" |

### Receipts Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `created_at` | TEXT | ISO timestamp of when the entry was created |
| `image_path` | TEXT | Path to the uploaded receipt image |
| `merchant` | TEXT | Merchant / place of purchase |
| `purchase_date` | TEXT | Date of purchase (YYYY-MM-DD) |
| `total` | REAL | Total cost |
| `category` | TEXT | "Fuel" or "Other" |
| `gallons` | REAL | Total gallons (only for fuel receipts) |
| `job_id` | INTEGER | Foreign key to jobs table |
| `raw_ocr_text` | TEXT | Full OCR text (for debugging) |
| `notes` | TEXT | Free-text description |

---

## OCR Parsing Logic

The OCR module (`server/ocr.ts`) processes receipt images in two steps:

1. **Text extraction** — sends the image to Google Cloud Vision's `TEXT_DETECTION` endpoint and receives the full text.

2. **Field parsing** — uses heuristics to extract structured data:
   - **Merchant**: First non-empty line that looks like a business name (skips dates, phone numbers, zip codes)
   - **Date**: Matches common US date formats (MM/DD/YYYY, MM-DD-YY, ISO, and month-name formats)
   - **Total**: Looks for lines containing "total", "amount due", "balance due" and extracts the dollar amount; falls back to the largest dollar amount found
   - **Fuel detection**: Scans for keywords like "gas", "fuel", "diesel", "unleaded", "gallons"
   - **Gallons**: Matches patterns like "12.345 GAL", "12.345 gallons", or "Volume: 12.345"

All parsed fields are **pre-filled but editable** — the user always has final say before saving.

---

## Customization

### Adding More Seed Jobs

Edit the `seedDatabase()` function in `server/storage.ts`:

```typescript
const seedJobs: InsertJob[] = [
  { jobName: "Your Job Name Here", status: "Active" },
  // ... add more
];
```

### Changing the Theme

The app uses Tailwind CSS with custom CSS variables in `client/src/index.css`. Edit the HSL values in the `:root` and `.dark` sections to change colors.

### Changing the Upload Size Limit

Edit the `limits` option in `server/routes.ts`:

```typescript
const upload = multer({
  // ...
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});
```

---

## Troubleshooting

### "No text was detected" after uploading a receipt

- Make sure `GOOGLE_CLOUD_API_KEY` is set correctly in your environment
- Verify the Vision API is enabled in your Google Cloud project
- Check the server logs for error messages

### Database locked errors

- Make sure only one instance of the server is running
- The app uses WAL mode for better concurrent read performance

### Images not loading

- The `uploads/` directory must be accessible by the Express server
- In production, make sure the `uploads/` directory exists and has write permissions

---

## License

This project is yours to own, modify, and deploy as you see fit. No vendor lock-in, no external dependencies beyond Google Cloud Vision (which is optional).
