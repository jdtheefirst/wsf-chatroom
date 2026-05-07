"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
  Bell,
  Check,
  AlertCircle,
  DollarSign,
  Globe,
  Building2,
  Flag,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export type EventData = {
  id: string;
  organizer_type: "club" | "association" | "wsf";
  organizer_id: string;
  title: string;
  slug: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  visibility: "local" | "national" | "international" | "wsf_featured";
  location: string | null;
  max_participants: number | null;
  registration_required: boolean;
  registration_deadline: string | null;
  fee_amount: number | null;
  fee_currency: string;
  attendee_count?: number;
  user_registration_status?: "registered" | "waiting_list" | "cancelled";
};

interface EventReferenceProps {
  event: EventData;
  messageId: string;
  onRemind?: (eventId: string, remindAt: Date) => Promise<void>;
  onViewEvent?: (eventId: string, slug: string) => void;
  isOwn?: boolean;
}

export function EventReference({
  event,
  onRemind,
  onViewEvent,
  isOwn,
}: EventReferenceProps) {
  const [settingReminder, setSettingReminder] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);

  const getVisibilityIcon = () => {
    switch (event.visibility) {
      case "wsf_featured":
        return <Flag className="h-4 w-4 text-purple-600" />;
      case "international":
        return <Globe className="h-4 w-4 text-blue-600" />;
      case "national":
        return <Flag className="h-4 w-4 text-green-600" />;
      default:
        return <Building2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getOrganizerBadge = () => {
    switch (event.organizer_type) {
      case "wsf":
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30">
            WSF Official
          </Badge>
        );
      case "association":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30">
            National Association
          </Badge>
        );
      case "club":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30">
            Club Event
          </Badge>
        );
    }
  };

  const isUpcoming = new Date(event.starts_at) > new Date();
  const isOngoing =
    new Date(event.starts_at) <= new Date() &&
    new Date(event.ends_at) >= new Date();
  const isPast = new Date(event.ends_at) < new Date();

  const formatDateRange = () => {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);

    if (start.toDateString() === end.toDateString()) {
      return `${format(start, "MMM d, yyyy")} • ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
    }
    return `${format(start, "MMM d, h:mm a")} - ${format(end, "MMM d, h:mm a")}`;
  };

  const handleSetReminder = async () => {
    if (!onRemind) return;

    // Default to 1 hour before event
    const remindAt = new Date(
      new Date(event.starts_at).getTime() - 60 * 60 * 1000,
    );
    if (remindAt > new Date()) {
      setSettingReminder(true);
      await onRemind(event.id, remindAt);
      setReminderSet(true);
      setSettingReminder(false);
    }
  };

  return (
    <Card
      className={cn(
        "mt-3 overflow-hidden transition-all hover:shadow-md cursor-pointer",
        isOngoing && "border-green-500 border-2",
        isPast && "opacity-70",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "px-4 py-2 flex items-center justify-between text-sm flex-wrap gap-2",
          event.visibility === "wsf_featured" &&
            "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30",
          event.visibility === "international" &&
            "bg-blue-50 dark:bg-blue-950/30",
          event.visibility === "national" && "bg-green-50 dark:bg-green-950/30",
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {getVisibilityIcon()}
          <span className="capitalize font-medium">
            {event.visibility.replace("_", " ")}
          </span>
          {getOrganizerBadge()}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {event.registration_required && (
            <Badge variant="outline" className="gap-1">
              <Ticket className="h-3 w-3" />
              Registration Required
            </Badge>
          )}
          {event.fee_amount && event.fee_amount > 0 && (
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {event.fee_amount} {event.fee_currency}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4" onClick={() => onViewEvent?.(event.id, event.slug)}>
        {/* Title */}
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {event.title}
        </h3>

        {/* Date & Time */}
        <div className="flex items-start gap-2 mb-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <span
              className={cn(
                isOngoing && "text-green-600 font-semibold",
                isUpcoming && "text-blue-600",
                isPast && "text-muted-foreground",
              )}
            >
              {isOngoing ? "🔴 ONGOING" : isUpcoming ? "Upcoming" : "Past"}
            </span>
            <span className="mx-2">•</span>
            <span>{formatDateRange()}</span>
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-start gap-2 mb-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{event.location}</span>
          </div>
        )}

        {/* Description Preview */}
        {event.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {event.max_participants && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>
                  {event.attendee_count || 0}/{event.max_participants}
                </span>
              </div>
            )}

            {event.registration_deadline && isUpcoming && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Register by{" "}
                  {format(new Date(event.registration_deadline), "MMM d")}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isUpcoming && !isPast && !reminderSet && onRemind && !isOwn && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetReminder();
                }}
                disabled={settingReminder}
                className="gap-1"
              >
                {settingReminder ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Bell className="h-3 w-3" />
                )}
                Remind Me
              </Button>
            )}

            {reminderSet && (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" />
                Reminder Set
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewEvent?.(event.id, event.slug);
              }}
              className="gap-1"
            >
              View Details
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Registration Status */}
      {event.user_registration_status && (
        <div className="px-4 py-2 bg-muted/50 text-sm border-t">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span>
              {event.user_registration_status === "registered"
                ? "You're registered for this event!"
                : event.user_registration_status === "waiting_list"
                  ? "You're on the waiting list"
                  : "Registration cancelled"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
