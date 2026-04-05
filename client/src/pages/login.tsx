import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HardHat } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();

  const [isLoginView, setIsLoginView] = useState(true); // The Toggle Switch
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // THE FIX: Add the two new state variables to hold the text while typing
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Tell the form which gate to drive to based on the toggle switch
    const endpoint = isLoginView ? "/api/auth/login" : "/api/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // THE FIX: Package up the new fields into the truck before sending it to the server
        body: JSON.stringify({
          username,
          password,
          fullName,
          email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || (isLoginView ? "Login failed" : "Registration failed"));
        setIsSubmitting(false);
        return;
      }

      // Success! Drive through to the dashboard
      setLocation("/");
      window.location.reload();
    } catch (err) {
      setError(isLoginView ? "Login failed" : "Registration failed");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      
      {/* Site Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="bg-primary p-3 rounded-full mb-3 shadow-sm">
          <HardHat className="h-10 w-10 text-white" />
        </div>
        {/* THE FIX: Updated the sign to ReceiptLog! */}
        <h1 className="text-3xl font-bold text-gray-900">ReceiptLog</h1>
      </div>

      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="text-center text-xl">
            {isLoginView ? "Sign in to your account" : "Create a new account"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* THE FIX: Conditionally display Full Name and Email ONLY when registering */}
            {!isLoginView && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Full Name</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Mike Zahn"
                    autoComplete="name"
                    required={!isLoginView} // Only required if they are signing up
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mike@example.com"
                    autoComplete="email"
                    required={!isLoginView} 
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLoginView ? "current-password" : "new-password"}
                required
                minLength={6} // Enforce a basic security minimum for new accounts
              />
              {!isLoginView && (
                <p className="text-xs text-muted-foreground mt-1">
                  Password must be at least 6 characters.
                </p>
              )}
            </div>

            {error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 font-medium text-center">{error}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full text-md h-11" disabled={isSubmitting}>
              {isSubmitting 
                ? "Please wait..." 
                : (isLoginView ? "Sign In" : "Create Account")}
            </Button>
          </form>

          {/* The Toggle Button */}
          <div className="mt-6 text-center text-sm border-t pt-4">
            <span className="text-muted-foreground">
              {isLoginView ? "Don't have a badge yet? " : "Already have a badge? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsLoginView(!isLoginView);
                setError(""); // Clear any errors when switching
              }}
              className="text-primary hover:underline font-semibold"
            >
              {isLoginView ? "Sign up here" : "Sign in here"}
            </button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
