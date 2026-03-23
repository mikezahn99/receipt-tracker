/**
 * New Receipt Page
 *
 * Workflow:
 * 1. User uploads or captures a photo of a receipt.
 * 2. The image is sent to the backend OCR endpoint.
 * 3. Extracted fields are pre-filled in the form.
 * 4. User reviews/edits all fields, selects a job, and saves.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Camera,
  Upload,
  Loader2,
  Save,
  Fuel,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";

// ── Form validation schema ──
// This mirrors insertReceiptSchema but is specific to the form UI
const formSchema = z.object({
  merchant: z.string().optional(),
  purchaseDate: z.string().optional(),
  total: z.string().optional().refine(
    (val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Total must be a positive number" }
  ),
  category: z.enum(["Fuel", "Other"]),
  gallons: z.string().optional().refine(
    (val) => {
      if (!val || val === "") return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Gallons must be a positive number" }
  ),
  jobId: z.string().min(1, "You must select a job"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewReceiptPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── Image upload state ──
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [ocrDone, setOcrDone] = useState(false);

  // ── Fetch active jobs for the dropdown ──
  const { data: activeJobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/active"],
  });

  // ── Form setup ──
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      merchant: "",
      purchaseDate: "",
      total: "",
      category: "Other",
      gallons: "",
      jobId: "",
      notes: "",
    },
  });

  const watchCategory = form.watch("category");

  // ── OCR mutation ──
  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      // We can't use apiRequest for multipart, so use fetch directly
      // (apiRequest sets Content-Type: application/json)
      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${API_BASE}/api/receipts/ocr`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "OCR failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Pre-fill form fields with OCR results
      if (data.merchant) form.setValue("merchant", data.merchant);
      if (data.purchaseDate) form.setValue("purchaseDate", data.purchaseDate);
      if (data.total != null) form.setValue("total", String(data.total));
      if (data.category) form.setValue("category", data.category);
      if (data.gallons != null) form.setValue("gallons", String(data.gallons));
      if (data.imagePath) setImagePath(data.imagePath);
      if (data.rawOcrText) setRawOcrText(data.rawOcrText);
      setOcrDone(true);

      toast({
        title: "Receipt scanned",
        description: data.rawOcrText
          ? "Fields have been pre-filled from the receipt. Please review before saving."
          : "No text was detected. You may need to set up your Google Cloud Vision API key, or enter the fields manually.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "OCR Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Save receipt mutation ──
  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        imagePath: imagePath,
        merchant: values.merchant || null,
        purchaseDate: values.purchaseDate || null,
        total: values.total ? parseFloat(values.total) : null,
        category: values.category,
        gallons: values.gallons ? parseFloat(values.gallons) : null,
        jobId: parseInt(values.jobId),
        rawOcrText: rawOcrText || null,
        notes: values.notes || null,
      };
      const res = await apiRequest("POST", "/api/receipts", body);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate the receipts list cache so it refreshes
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({
        title: "Receipt saved",
        description: "The receipt has been recorded successfully.",
      });
      navigate("/");
    },
    onError: (err: Error) => {
      toast({
        title: "Save failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Handle file selection ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Send to OCR
    ocrMutation.mutate(file);
  };

  // ── Submit handler ──
  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
        New Receipt
      </h2>

      {/* ── Step 1: Upload Image ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Receipt Photo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* File upload input — "capture" attribute prompts camera on mobile */}
          <label
            className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            data-testid="upload-area"
          >
            {ocrMutation.isPending ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Processing receipt...</span>
              </div>
            ) : imagePreview ? (
              <img
                src={imagePreview}
                alt="Receipt preview"
                className="max-h-36 rounded object-contain"
                data-testid="image-preview"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <span className="text-sm">Tap to upload or take a photo</span>
                <span className="text-xs">PNG, JPG up to 10 MB</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              disabled={ocrMutation.isPending}
              data-testid="input-file"
            />
          </label>

          {/* Show OCR status */}
          {ocrDone && !rawOcrText && (
            <div className="mt-3 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                No text was detected. Make sure your Google Cloud Vision API key is configured,
                or enter the fields manually below.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Review & Edit Fields ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Receipt Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Category badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Category:</span>
                {watchCategory === "Fuel" ? (
                  <Badge variant="secondary" className="gap-1">
                    <Fuel className="h-3 w-3" /> Fuel
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <ShoppingBag className="h-3 w-3" /> Other
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() =>
                    form.setValue("category", watchCategory === "Fuel" ? "Other" : "Fuel")
                  }
                  data-testid="button-toggle-category"
                >
                  Switch to {watchCategory === "Fuel" ? "Other" : "Fuel"}
                </Button>
              </div>

              {/* Merchant */}
              <FormField
                control={form.control}
                name="merchant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant / Place of Purchase</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Home Depot"
                        {...field}
                        data-testid="input-merchant"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date and Total side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Cost ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          data-testid="input-total"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Gallons — only shown when category is Fuel */}
              {watchCategory === "Fuel" && (
                <FormField
                  control={form.control}
                  name="gallons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Gallons</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          {...field}
                          data-testid="input-gallons"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Job selection — required */}
              <FormField
                control={form.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Job <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-job">
                          <SelectValue placeholder="Select a job..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {jobsLoading ? (
                          <div className="p-2">
                            <Skeleton className="h-6 w-full" />
                          </div>
                        ) : activeJobs && activeJobs.length > 0 ? (
                          activeJobs.map((job) => (
                            <SelectItem key={job.id} value={String(job.id)}>
                              {job.jobName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">
                            No active jobs. Add one in the Jobs page.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes / Description */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description / Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What was purchased? Any additional details..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  data-testid="button-save"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Save Receipt
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── Raw OCR Text (collapsible, for debugging) ── */}
      {rawOcrText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Raw OCR Text (debug)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap"
              data-testid="raw-ocr-text"
            >
              {rawOcrText}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
