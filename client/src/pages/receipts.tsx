/**
 * Receipts Page
 *
 * Shows a filterable table of all past receipts with columns for:
 * date, merchant, job, category, total, gallons.
 *
 * Filters: date range, job, category (Fuel / Other).
 */

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Filter, Fuel, ShoppingBag } from "lucide-react";

export default function ReceiptsPage() {
  // ── Filter state ──
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  // Map job IDs to names for display
  const jobMap = new Map(allJobs?.map((j) => [j.id, j.jobName]) ?? []);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setJobFilter("all");
    setCategoryFilter("all");
  };
  const handleDelete = async (id: number) => {
  const confirmed = window.confirm("Delete this receipt?");
  if (!confirmed) return;

  const response = await fetch(`/api/receipts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    alert("Failed to delete receipt");
    return;
  }

  window.location.reload();
};
  
  const hasFilters = startDate || endDate || jobFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
            Receipts
          </h2>
          <p className="text-sm text-muted-foreground">
            {receipts ? `${receipts.length} receipt${receipts.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        <Link href="/new">
          <Button data-testid="button-new-receipt">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Receipt
          </Button>
        </Link>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Job</label>
              <Select value={jobFilter} onValueChange={setJobFilter}>
                <SelectTrigger data-testid="select-job-filter">
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
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Fuel">Fuel</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Clear all filters
            </Button>
          )}
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
          ) : receipts && receipts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px] whitespace-nowrap">Date</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead className="w-[90px]">Category</TableHead>
                    <TableHead className="w-[100px] text-right whitespace-nowrap">Total</TableHead>
                    <TableHead className="w-[100px] text-right whitespace-nowrap">Gallons</TableHead>
                    <TableHead>Actions</TableHead>
                    </TableRow> 
                  </TableHeader>                
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id} data-testid={`receipt-row-${r.id}`}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.purchaseDate
                          ? format(parseISO(r.purchaseDate), "MM/dd/yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.merchant || "Unknown"}
                      </TableCell>
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
<TableCell>
  <button onClick={() => handleDelete(r.id)}>Delete</button>
                    </TableCell>
                    </TableRow>
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
    </div>
  );
}
