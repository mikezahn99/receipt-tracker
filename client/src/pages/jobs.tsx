/**
 * Jobs Page
 *
 * Displays all jobs and allows:
 * - Creating new jobs
 * - Toggling job status (Active / Inactive)
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
import { PlusCircle, Briefcase, ToggleLeft, ToggleRight } from "lucide-react";

export default function JobsPage() {
  const { toast } = useToast();
  const [newJobName, setNewJobName] = useState("");

  // ── Fetch all jobs ──
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // ── Create job mutation ──
  const createMutation = useMutation({
    mutationFn: async (jobName: string) => {
      const res = await apiRequest("POST", "/api/jobs", { jobName, status: "Active" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/active"] });
      setNewJobName("");
      toast({ title: "Job created", description: "The new job has been added." });
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

  const handleCreate = () => {
    const trimmed = newJobName.trim();
    if (!trimmed) {
      toast({ title: "Enter a job name", variant: "destructive" });
      return;
    }
    createMutation.mutate(trimmed);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
          Jobs
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage the list of jobs that receipts can be assigned to.
        </p>
      </div>

      {/* ── Add new job ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add New Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Job name, e.g., Bridge Repair – Route 46"
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
                  <TableHead>Job Name</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} data-testid={`job-row-${job.id}`}>
                    <TableCell className="text-sm font-medium">{job.jobName}</TableCell>
                    <TableCell>
                      {job.status === "Active" ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                        data-testid={`button-toggle-${job.id}`}
                      >
                        {job.status === "Active" ? (
                          <>
                            <ToggleRight className="h-3.5 w-3.5 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-3.5 w-3.5 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No jobs yet.</p>
              <p className="text-xs mt-1">Add your first job above.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
