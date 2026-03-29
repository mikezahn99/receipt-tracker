import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { LogOut, HardHat } from "lucide-react";

export default function Navbar() {
  const [, setLocation] = useLocation();

  // 1. Check who is currently on the clock
  const { data: user } = useQuery<{ id: number; username: string }>({
    queryKey: ["/api/user"],
  });

  // 2. The action to clock out
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Clear the local cache and send them back to the login gate
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/auth"); 
    },
  });

  // If nobody is logged in, don't show the bar at all
  if (!user) return null;

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Left Side: Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <Link href="/" className="text-xl font-bold text-gray-900 cursor-pointer">
              PaveTrack
            </Link>
          </div>

          {/* Right Side: User & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-semibold text-gray-700">
                {user.username}
              </span>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                On Clock
              </span>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {logoutMutation.isPending ? "Clocking out..." : "Logout"}
            </Button>
          </div>
          
        </div>
      </div>
    </nav>
  );
}
