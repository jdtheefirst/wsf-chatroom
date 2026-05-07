"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Search, MapPin, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/context/AuthContext";

interface EventPickerProps {
  onSelect: (eventId: string) => void;
}

export function EventPicker({ onSelect }: EventPickerProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events_feed")
        .select(
          `
          *,
          attendee_count:event_registrations(count)
        `,
        )
        .eq("published", true)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.location?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming events found
            </div>
          ) : (
            filteredEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelect(event.id)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className="font-medium mb-1 line-clamp-1">
                  {event.title}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(event.starts_at), "MMM d, yyyy")}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="line-clamp-1">{event.location}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.attendee_count || 0} attending
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {event.visibility.replace("_", " ")}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
