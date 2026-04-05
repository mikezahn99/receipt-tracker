/**
 * Jobs Page
 *
 * Displays all jobs and allows:
 * - Creating Company (Public) or Personal (Private) jobs/trucks
 * - Toggling job status (Active / Inactive)
 * - Deleting jobs permanently
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
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
import { PlusCircle, Briefcase, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export default function JobsPage() {
  const { toast } = useToast();
  const [newJobName, setNewJobName] = useState("");
  // THE FIX: New state for the dropdown menu
  const [jobType, setJobType] = useState<"company" | "personal">("company");

  const { data: user } = useQuery<any>({ queryKey: ["/api/me"] });
  const isAdmin = user?.role === "admin";

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const createMutation = useMutation({
    mutationFn: async (jobName: string) => {
      // Send the 'isPersonal' flag to the backend based on the dropdown
      const payload = { 
        jobName, 
        status: "Active",
        isPersonal: jobType === "personal" 
      };
      const res = await apiRequest("POST", "/api/jobs", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/active"] });
      setNewJobName("");
      toast({ title: "Success", description: "Added successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: number; currentStatus: string }) => {
      const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
      const res = await apiRequest("PATCH", `/api/jobs/${id}`, { status: newStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/active"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/active"] });
      toast({ title: "Deleted", description: "Permanently removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    const trimmed = newJobName.trim();
    if (!trimmed) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    createMutation.mutate(trimmed);
  };

  const handleDelete = (id: number) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this? Any receipts assigned to it will lose their reference."
    );
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
          Jobs & Trucks
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage company-wide jobs or your own personal equipment.
        </p>
      </div>

      {/* ── Add new job/truck ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add New Record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
            <Input
              placeholder="Job name or Truck number..."
              value={newJobName}
              onChange={(e) => setNewJobName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              data-testid="input-new-job"
            />
            
            {/* THE FIX: The new public/private dropdown for everyone */}
            <Select value={jobType} onValueChange={(val: "company" | "personal") => setJobType(val)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company (Public to all)</SelectItem>
                <SelectItem value="personal">Personal (Private to me)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-add-job"
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Jobs table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[150px]">Visibility</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} data-testid={`job-row-${job.id}`}>
                    <TableCell className="text-sm font-medium">{job.jobName}</TableCell>
                    
                    <TableCell>
                      {job.userId ? (
                        <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50 border-blue-200">
                          Personal (Private)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-600 bg-gray-50 border-gray-200">
                          Company (Public)
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {job.status === "Active" ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-right">
                      {isAdmin || job.userId === user?.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() =>
                              toggleMutation.mutate({
                                id: job.id,
                                currentStatus: job.status,
                              })
                            }
                            disabled={toggleMutation.isPending}
                          >
                            {job.status === "Active" ? (
                              <><ToggleRight className="h-3.5 w-3.5 mr-1" /> Deactivate</>
                            ) : (
                              <><ToggleLeft className="h-3.5 w-3.5 mr-1" /> Activate</>
                            )}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(job.id)}
                            disabled={deleteMutation.isPending}
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                         <span className="text-xs text-muted-foreground italic pr-2">Company Managed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No jobs or trucks found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
