// ChatroomDiscovery - Improved version with sign out button
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  chatrooms,
  getChatroomIcon,
  getColorClass,
} from "@/lib/chatrooms/config";
import { checkEligibility } from "@/lib/chatrooms/eligibility";
import {
  ChatroomDefinition,
  ChatroomType,
  EligibilityStatus,
} from "@/lib/chatrooms/types";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Lock,
  GlobeIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  MessageSquare,
  LogOut,
  User,
  Shield,
  HelpCircle,
} from "lucide-react";
import { LoginDialog } from "../auth/LoginDialog";
import { ConfettiOnMount } from "../layout/ConfettiOnMount";

type StatusMap = Record<ChatroomType, EligibilityStatus>;

// Chatroom descriptions for better UX
const chatroomDescriptions: Record<ChatroomType, string> = {
  wsf_fans:
    "Connect with the global Samma community. Share experiences and get inspired.",
  wsf_students:
    "Exclusive space for enrolled students to discuss training and progress.",
  wsf_club_owners:
    "Network with club owners worldwide. Share best practices and resources.",
  psa: "Coordinate with provincial leaders in your region.",
  nsa: "Collaborate with national association members across countries.",
  wsf_committee:
    "Strategic discussions for WSF leadership and decision-making.",
};

// Simplified eligibility messages
const getEligibilityMessage = (
  status: EligibilityStatus
): { message: string; icon: React.ReactNode } => {
  if (status.state === "loading")
    return {
      message: "Checking access...",
      icon: <AlertCircle className="h-4 w-4 animate-pulse" />,
    };
  if (status.state === "eligible")
    return {
      message: "You can join this chat",
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    };

  // Friendly error messages
  const friendlyMessages: Record<string, string> = {
    "Admission number required.": "Enroll as a student first",
    "Club owner/manager membership required.": "Become a club owner",
    "Provincial association leadership required.":
      "Join your provincial association",
    "National association membership required.":
      "Join your national association",
    "WSF leadership role required.": "Leadership access only",
    "Sign in to see eligibility.": "Sign in to check access",
    "Country code required for PSA chatroom.":
      "Complete your profile with country",
    "Country code required for NSA chatroom.":
      "Complete your profile with country",
  };

  const reason = status.reason || "Access restricted";
  return {
    message: friendlyMessages[reason] || reason,
    icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
  };
};

export function ChatroomDiscovery() {
  const { supabase, profile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [statuses, setStatuses] = useState<StatusMap>(() =>
    chatrooms.reduce((acc, room) => {
      acc[room.id] = { state: "loading" };
      return acc;
    }, {} as StatusMap)
  );
  const [loading, setLoading] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Update showLoginDialog based on profile changes
  useEffect(() => {
    if (!profile) {
      setShowLoginDialog(false);
    }
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    const fetchEligibility = async () => {
      setLoading(true);
      const entries = await Promise.all(
        chatrooms.map(async (room) => {
          const status = await checkEligibility(
            supabase,
            profile,
            room.id,
            profile?.country_code ?? null
          );
          return [room.id, status] as const;
        })
      );

      if (!cancelled) {
        setStatuses((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchEligibility();
    }

    return () => {
      cancelled = true;
    };
  }, [profile, supabase, authLoading]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
      toast.success("Successfully signed out");
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setSigningOut(false);
      setShowSignOutDialog(false);
    }
  };

  const handleJoin = async (roomId: ChatroomType) => {
    if (!profile) {
      // Show login dialog if user is not authenticated
      setShowLoginDialog(true);
      return;
    }

    try {
      const res = await fetch("/api/chatrooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatroomId: roomId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to join chatroom");
      }

      const data = await res.json();
      toast.success("Welcome to the chatroom!");
      router.push(`/chatrooms/${data.chatroom_id}`);
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message);
    }
  };

  const handlePreview = (
    room: ChatroomDefinition,
    status: EligibilityStatus
  ) => {
    if (!profile) {
      setShowLoginDialog(true);
      return;
    }

    if (status.state === "eligible") {
      handleJoin(room.id);
    } else {
      // Show eligibility requirements in a nice way
      toast.info(`To join ${room.title}:`, {
        description: getEligibilityMessage(status).message,
        duration: 5000,
      });
    }
  };

  // Fixed UserProfileMenu component - Single Dialog approach
  const UserProfileMenu = () => (
    <div className="absolute right-4 top-4 z-50">
      <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <div className="flex items-center gap-3">
          {/* Desktop version with full profile info */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg border bg-card/80 backdrop-blur-sm px-3 py-2 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium truncate max-w-[120px]">
                {profile?.full_name || "User"}
              </span>
              <span className="text-xs text-muted-foreground">
                {profile?.email?.split("@")[0]}
              </span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </div>

          {/* Mobile version - simplified button */}
          <div className="sm:hidden">
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-dashed"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </div>
        </div>

        {/* SINGLE Dialog Content for both desktop and mobile */}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Sign Out
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You'll need to sign in again to
              access chatrooms.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {profile?.full_name || "User"}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {profile?.email}
                </p>
                {profile?.admission_no && (
                  <p className="text-xs text-muted-foreground">
                    Admission: {profile.admission_no}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSignOutDialog(false)}
              disabled={signingOut}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
              className="gap-2"
            >
              {signingOut ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (authLoading || loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-2 sm:px-6 py-12">
        <div className="space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto min-h-screen max-w-6xl px-2 sm:px-6 py-12 relative">
        {/* Sign Out Button - Top Right */}
        {profile && <UserProfileMenu />}

        {/* Hero Section */}
        <div className="mb-12 text-center">
          <ConfettiOnMount />
          {!profile && (
            <div className="mb-6">
              <Button
                onClick={() => setShowLoginDialog(true)}
                className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                size="lg"
              >
                Sign In to Join Chatrooms
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in once, access all WSF platforms
              </p>
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
            <Sparkles className="h-4 w-4" />
            {profile
              ? `Welcome, ${profile.full_name || profile.email}!`
              : "Welcome to WSF Chatrooms"}
          </div>
          <h1 className="mb-4 text-2xl sm:text-4xl font-bold tracking-tight sm:text-5xl">
            Connect with the{" "}
            <span className="text-primary">Samma Community</span>
          </h1>
          <p className="mx-auto max-w-2xl text-md sm:text-lg text-muted-foreground">
            {profile
              ? "Browse and join chatrooms based on your membership level"
              : "Sign in to discover chatrooms you can join based on your WSF membership"}
          </p>

          {/* REMOVED the Quick Stats section with duplicate sign out button */}
        </div>

        {/* Compact Stats Banner */}
        <div className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-lg sm:text-xl font-bold">6</div>
              <div className="text-xs text-muted-foreground">Chatrooms</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-lg sm:text-xl font-bold">Global</div>
              <div className="text-xs text-muted-foreground">Reach</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-lg sm:text-xl font-bold">Auto</div>
              <div className="text-xs text-muted-foreground">Translation</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-lg sm:text-xl font-bold">24/7</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-lg sm:text-xl font-bold">Secure</div>
              <div className="text-xs text-muted-foreground">Chat</div>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <div className="text-lg sm:text-xl font-bold">SSO</div>
              <div className="text-xs text-muted-foreground">Access</div>
            </div>
          </div>
        </div>

        {/* Chatroom Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {chatrooms.map((room) => {
            const status = statuses[room.id] ?? { state: "loading" };
            const Icon = getChatroomIcon(room.id);
            const eligibility = getEligibilityMessage(status);
            const isEligible = status.state === "eligible";

            return (
              <Card
                key={room.id}
                className={cn(
                  "group transition-all duration-300 hover:shadow-lg",
                  isEligible ? "hover:border-primary" : "opacity-90"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "rounded-lg p-2",
                          getColorClass(room.color), // Use the color from config
                          !isEligible && "opacity-50" // Dim if not eligible
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{room.title}</CardTitle>
                        <CardDescription className="flex items-center gap-1 text-xs">
                          {room.visibility === "public" ? (
                            <>
                              <GlobeIcon className="h-3 w-3" />
                              Open Access
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              Restricted Access
                            </>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={isEligible ? "default" : "outline"}
                      className={cn(
                        isEligible && "bg-green-500 hover:bg-green-600"
                      )}
                    >
                      {isEligible ? "Join Now" : "Restricted"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    {chatroomDescriptions[room.id]}
                  </p>

                  {/* Features */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Features:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {room.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-1 sm:gap-2 text-sm">
                      {eligibility.icon}
                      <span
                        className={cn(
                          isEligible
                            ? "text-green-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {eligibility.message}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={isEligible ? "default" : "outline"}
                      onClick={() => handlePreview(room, status)}
                      className={cn(
                        isEligible && "bg-primary hover:bg-primary/90"
                      )}
                    >
                      {!profile
                        ? "Sign In to View"
                        : isEligible
                        ? "Enter Chat"
                        : "View Details"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Help Section */}
        <div className="mt-16 rounded-lg border bg-muted/50 p-2 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-2 sm:p-3">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">
                Need help with account access?
              </h3>
              <p className="text-muted-foreground text-sm">
                {profile ? (
                  <>
                    If you're having issues with chatroom access or need to
                    manage your account, you can{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => setShowSignOutDialog(true)}
                    >
                      sign out
                    </Button>{" "}
                    and sign back in, or contact support for assistance.
                  </>
                ) : (
                  "Sign in to check your eligibility for different chatrooms. Some chatrooms require specific membership levels."
                )}
              </p>
            </div>
          </div>
        </div>
      </main>
      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        message={
          profile
            ? undefined
            : "Sign in with your World Samma account to access chatrooms"
        }
      />
    </>
  );
}
