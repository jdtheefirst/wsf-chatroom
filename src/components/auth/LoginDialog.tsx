// components/auth/LoginDialog.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Lock, GlobeIcon, MessageSquare } from "lucide-react";
import LoginForm from "./LoginForm";
import { useAuth } from "@/lib/context/AuthContext";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

export function LoginDialog({ open, onOpenChange, message }: LoginDialogProps) {
  // Local state to track successful login
  const [loginSuccess, setLoginSuccess] = useState(false);
  const { profile } = useAuth();

  // Use effect to close dialog if user is already logged in
  useEffect(() => {
    if (profile && open) {
      onOpenChange(false);
    }
  }, [profile, open, onOpenChange]);

  // Close dialog when login is successful
  useEffect(() => {
    if (loginSuccess && open) {
      // Small delay to show success message before closing
      const timer = setTimeout(() => {
        onOpenChange(false);
        setLoginSuccess(false); // Reset for next time
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [loginSuccess, open, onOpenChange]);

  const handleRedirectLogin = () => {
    onOpenChange(false);
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://worldsamma.org/login?returnTo=${returnUrl}`;
  };

  const benefits = [
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Join Chatrooms",
      description: "Participate in global discussions with Samma community",
    },
    {
      icon: <GlobeIcon className="w-5 h-5" />,
      title: "Cross-Platform Access",
      description: "Single sign-on works across all World Samma platforms",
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: "Secure Access",
      description: "Your authentication works securely across domains",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "Unified Experience",
      description: "One login for courses, chatrooms, and all WSF services",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Sign In to Access Chatrooms
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {message ||
              "Use your World Samma account to join global conversations"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Chatroom-specific benefits */}
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <Card
                key={index}
                className="border-2 border-gray-100 hover:border-primary/20 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      {benefit.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{benefit.title}</h4>
                      <p className="text-xs mt-1">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Domain information */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-700 text-sm">
                <GlobeIcon className="w-4 h-4" />
                <span className="font-medium">Single Sign-On Active</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Your login will work across all worldsamma.org domains
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <p className="w-full font-semibold text-base text-center">
              Sign In with WSF Account
            </p>

            {/* Pass the success handler to LoginForm */}
            <LoginForm onLoginSuccess={() => setLoginSuccess(true)} />

            <div className="text-center">
              <p className="text-sm">
                New to Samma?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary font-semibold"
                  onClick={handleRedirectLogin}
                >
                  Create a free account
                </Button>
              </p>
            </div>
          </div>

          {/* Redirect notice */}
          <div className="text-center text-xs text-gray-500">
            <p>You will be redirected to worldsamma.org for authentication</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
