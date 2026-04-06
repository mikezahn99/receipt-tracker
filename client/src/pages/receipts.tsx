/**
 * Receipts Page
 *
 * Shows a filterable table of all past receipts with columns for:
 * date, merchant, job, category, total, gallons.
 * Admin View: Includes a "Logged By" column and fetches the company roster.
 *
 * Filters: date range, job, category (Fuel / Other).
 * Sorting: Newest First, Oldest First.
 * Export: Generates a CSV matching the company expense report.
 */

import { useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Receipt, Job } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { 
  PlusCircle, 
  Filter, 
  Fuel, 
  ShoppingBag, 
  ArrowUpDown,
  Download,
  User as UserIcon
} from "lucide-react";

export default function ReceiptsPage() {
  const { toast } = useToast();
  
  // ── Filter state ──
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    merchant: "",
    purchaseDate: "",
    total: "",
    category: "Other",
    gallons: "",
    jobId: "",
    notes: "",
  });
  
  // Build query string from filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (jobFilter && jobFilter !== "all") params.set("jobId", jobFilter);
    if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  // ── Data fetching ──
  const { data: user } = useQuery<any>({ queryKey: ["/api/me"] });
  const isAdmin = user?.role === "admin"; // Check if the current user is the boss
  
  const {
    data: receipts,
    isLoading: receiptsLoading,
  } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts", startDate, endDate, jobFilter, categoryFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/receipts${buildQueryString()}`);
      return res.json();
    },
  });

  const { data: allJobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // THE FIX: Fetch the roster ONLY if the user has an Admin badge
  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin, 
  });

  const jobMap = new Map(allJobs?.map((j) => [j.id, j.jobName]) ?? []);
  // THE FIX: Build a translation dictionary to map User IDs to Usernames
  const userMap = new Map(allUsers?.map((u) => [u.id, u.username]) ?? []);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setJobFilter("all");
    setCategoryFilter("all");
    setSortOrder("desc");
  };

  const setFilterToCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(format(firstDay, "yyyy-MM-dd"));
    setEndDate(format(lastDay, "yyyy-MM-dd"));
  };
  
  const truncateText = (text?: string | null, maxLength = 32) => {
    if (!text) return "—";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const handleEditClick = (receipt: Receipt) => {
    setEditingReceiptId(receipt.id);
    setEditForm({
      merchant: receipt.merchant || "",
      purchaseDate: receipt.purchaseDate || "",
      total: receipt.total != null ? String(receipt.total) : "",
      category: receipt.category || "Other",
      gallons: receipt.gallons != null ? String(receipt.gallons) : "",
      jobId: String(receipt.jobId),
      notes: receipt.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditingReceiptId(null);
    setEditForm({
      merchant: "",
      purchaseDate: "",
      total: "",
      category: "Other",
      gallons: "",
      jobId: "",
      notes: "",
    });
  };

  const handleEditFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleSaveEdit = async () => {
    if (!editingReceiptId) return;

    const response = await fetch(`/api/receipts/${editingReceiptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: editForm.merchant,
        purchaseDate: editForm.purchaseDate || null,
        total: editForm.total ? Number(editForm.total) : null,
        category: editForm.category,
        gallons: editForm.gallons ? Number(editForm.gallons) : null,
        jobId: Number(editForm.jobId),
        notes: editForm.notes,
      }),
    });

    if (!response.ok) {
      alert("Failed to update receipt");
      return;
    }

    handleCloseEdit();
    window.location.reload();
  };
  
  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Delete this receipt?");
    if (!confirmed) return;

    const response = await fetch(`/api/receipts/${id}`, { method: "DELETE" });

    if (!response.ok) {
      alert("Failed to delete receipt");
      return;
    }
    window.location.reload();
  };
  
  // The Front-Desk Sorter
  const filteredReceipts = receipts ? receipts.filter(r => {
    const dateStr = r.purchaseDate || (r.createdAt ? r.createdAt.substring(0, 10) : "");
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    if (jobFilter !== "all" && String(r.jobId) !== jobFilter) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    return true; 
  }) : [];

  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
    const dateA = new Date(a.purchaseDate || a.createdAt).getTime();
    const dateB = new Date(b.purchaseDate || b.createdAt).getTime();
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  const handleExportCSV = () => {
    if (!sortedReceipts || sortedReceipts.length === 0) {
      toast({ title: "No receipts to export", variant: "destructive" });
      return;
    }

    const userName = user?.fullName || user?.username || "Account Holder";
    
    // THE FIX: Conditionally add the "Logged By" column to the CSV header for Admins
    const csvHeaderRow = isAdmin 
      ? `"Date","Purchased From","Job","Description/Fuel Type","Fuel Gallons","Amount","Logged By"`
      : `"Date","Purchased From","Job","Description/Fuel Type","Fuel Gallons","Amount"`;

    const headerRows = [
      `"Mountain View Development & Contracting Co., Inc."`,
      `"Expense Tracker"`,
      `"Name: ${userName}"`,
      `""`, 
      csvHeaderRow
    ];

    const dataRows = sortedReceipts.map((r) => {
      const date = r.purchaseDate ? format(parseISO(r.purchaseDate), "MM/dd/yyyy") : "";
      const merchant = `"${(r.merchant || "").replace(/"/g, '""')}"`;
      const job = `"${(jobMap.get(r.jobId) || "").replace(/"/g, '""')}"`;
      
      let description = r.notes || "";
      if (r.category === "Fuel" && !description.toLowerCase().includes("fuel")) {
        description = `Fuel - ${description}`;
      }
      const cleanDesc = `"${description.replace(/"/g, '""')}"`;
      
      const gallons = r.gallons != null ? r.gallons : "";
      const amount = r.total != null ? r.total : "";

      // THE FIX: Conditionally pull the uploader's name for the CSV row if Admin
      const loggedByData = isAdmin 
        ? `,"${(userMap.get(r.userId) || `ID #${r.userId}`).replace(/"/g, '""')}"` 
        : "";

      return `${date},${merchant},${job},${cleanDesc},${gallons},${amount}${loggedByData}`;
    });

    const csvContent = [...headerRows, ...dataRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Expense_Report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export complete", description: "Your spreadsheet has been downloaded." });
  };

  const hasFilters = startDate || endDate || jobFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
            Receipts
          </h2>
          <p className="text-sm text-muted-foreground">
            {receipts ? `${filteredReceipts.length} receipt${filteredReceipts.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="bg-white">
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Link href="/new">
            <Button data-testid="button-new-receipt">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              New Receipt
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Job</label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {allJobs?.map((job) => (
                    <SelectItem key={job.id} value={String(job.id)}>
                      {job.jobName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Fuel">Fuel</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> Sort Date
              </label>
              <Select value={sortOrder} onValueChange={(v: "desc" | "asc") => setSortOrder(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Newest first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={setFilterToCurrentMonth}
            >
              Current Month
            </Button>
            
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={clearFilters}
              >
                Clear all filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          {receiptsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sortedReceipts && sortedReceipts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px] whitespace-nowrap">Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    {/* THE FIX: Show "Logged By" column header ONLY to Admin */}
                    {isAdmin && <TableHead className="w-[120px]">Logged By</TableHead>}
                    <TableHead>Job</TableHead>
                    <TableHead className="w-[90px]">Category</TableHead>
                    <TableHead className="w-[100px] text-right whitespace-nowrap">Total</TableHead>
                    <TableHead className="w-[100px] text-right whitespace-nowrap">Gallons</TableHead>
                    <TableHead className="min-w-[200px]">Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow> 
                </TableHeader>                
                <TableBody>
                  {sortedReceipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.purchaseDate
                          ? format(parseISO(r.purchaseDate), "MM/dd/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.merchant || "Unknown"}
                      </TableCell>
                      
                      {/* THE FIX: Show the Uploader's Username ONLY to Admin */}
                      {isAdmin && (
                        <TableCell className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2.5">
                          <UserIcon className="h-3 w-3" />
                          {userMap.get(r.userId) || `ID #${r.userId}`}
                        </TableCell>
                      )}

                      <TableCell className="text-sm text-muted-foreground">
                        {jobMap.get(r.jobId) || `Job #${r.jobId}`}
                      </TableCell>
                      <TableCell>
                        {r.category === "Fuel" ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Fuel className="h-3 w-3" /> Fuel
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <ShoppingBag className="h-3 w-3" /> Other
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {r.total != null ? `$${r.total.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {r.gallons != null ? r.gallons.toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[260px]">
                        <span title={r.notes || ""}>
                          {truncateText(r.notes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <button className="text-primary hover:underline" onClick={() => handleEditClick(r)}>Edit</button>
                          <button className="text-red-600 hover:underline" onClick={() => handleDelete(r.id)}>Delete</button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>              
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No receipts found.</p>
              <p className="text-xs mt-1">
                {hasFilters ? "Try adjusting your filters." : "Add your first receipt to get started."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ── Edit Modal ── */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Receipt</h3>
              <button onClick={handleCloseEdit} className="text-sm text-muted-foreground hover:text-gray-900">
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Merchant</label>
                <Input
                  name="merchant"
                  value={editForm.merchant}
                  onChange={handleEditFormChange}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Purchase Date</label>
                <Input
                  type="date"
                  name="purchaseDate"
                  value={editForm.purchaseDate}
                  onChange={handleEditFormChange}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Total</label>
                <Input
                  type="number"
                  step="0.01"
                  name="total"
                  value={editForm.total}
                  onChange={handleEditFormChange}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fuel">Fuel</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Gallons</label>
                <Input
                  type="number"
                  step="0.001"
                  name="gallons"
                  value={editForm.gallons}
                  onChange={handleEditFormChange}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Job</label>
                <Select
                  value={editForm.jobId}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, jobId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allJobs?.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>
                        {job.jobName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <Textarea
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditFormChange}
                  rows={4}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={handleCloseEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
