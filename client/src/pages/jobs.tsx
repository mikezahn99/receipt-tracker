/**
 * Jobs Page
 *
 * Displays all jobs and allows:
 * - Creating new jobs or personal trucks
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Briefcase, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export default function JobsPage() {
  const { toast } = useToast();
  const [newJobName, setNewJobName] = useState("");
  const [isPersonalTruck, setIsPersonalTruck] = useState(false); // Admin checkbox state

  // ── Fetch User & Badge ──
  const { data: user } = useQuery<any>({ queryKey: ["/api/me"] });
  const isAdmin = user?.role === "admin";

  // ── Fetch all jobs ──
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // ── Create job mutation ──
  const createMutation = useMutation({
    mutationFn: async (jobName: string) => {
      const payload: any = { jobName, status: "Active" };
      
      // If Admin explicitly checks the "Personal Truck" box, stamp it with their ID.
      // (If a regular crew member submits, the backend automatically stamps it for them!)
      if (isAdmin && isPersonalTruck && user?.id) {
        payload.userId = user.id;
      }

      const res = await apiRequest("POST", "/api/jobs", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/active"] });
      setNewJobName("");
      setIsPersonalTruck(false);
      toast({ title: "Success", description: "Added successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Toggle status mutation ──
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

  // ── Delete mutation ──
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
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
          {isAdmin ? "Company Jobs & Trucks" : "My Trucks & Company Jobs"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin 
            ? "Manage the master list of jobs and your personal trucks."
            : "Add your personal truck to log fuel, and view active company jobs."}
        </p>
      </div>

      {/* ── Add new job/truck ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            {isAdmin ? "Add New Job or Truck" : "Add Personal Truck"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder={isAdmin ? "Job name, e.g., Bridge Repair..." : "Truck number, e.g., F-250 #14"}
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                data-testid="input-new-job"
              />
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                data-testid="button-add-job"
              >
                Add
              </Button>
            </div>
            
            {/* The Admin-Only Checkbox */}
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
                <input 
                  type="checkbox" 
                  checked={isPersonalTruck}
                  onChange={(e) => setIsPersonalTruck(e.target.checked)}
                  className="rounded border-gray-300 w-4 h-4"
                />
                Make this a Personal Truck (Hide from the crew)
              </label>
            )}
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
                  <TableHead className="w-[130px]">Type</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} data-testid={`job-row-${job.id}`}>
                    <TableCell className="text-sm font-medium">{job.jobName}</TableCell>
                    
                    {/* The Visual Type Badge */}
                    <TableCell>
                      {job.userId ? (
                        <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50 border-blue-200">
                          Personal Truck
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-600 bg-gray-50 border-gray-200">
                          Company Job
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
                    
                    {/* The Security Gateway for Actions */}
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
