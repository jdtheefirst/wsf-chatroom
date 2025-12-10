// Enhanced config.ts with icons
import { LucideIcon, Users, GraduationCap, Building2, MapPin, Globe, Shield } from "lucide-react";
import { ChatroomDefinition, ChatroomType } from "./types";

export const chatrooms: ChatroomDefinition[] = [
  {
    id: "wsf_fans",
    title: "WSF Fans",
    subtitle: "Global Community Hub",
    visibility: "public",
    access: "All authenticated users",
    notes: "Public posts are shareable externally",
    features: ["Auto-translation", "Shareable posts", "Global reach"],
    color: "blue"
  },
  {
    id: "wsf_students",
    title: "WSF Students",
    subtitle: "Learning & Progress",
    visibility: "private",
    access: "Students only (admission required)",
    notes: "Private discussions about training",
    features: ["Auto-translation", "Student support", "Progress tracking"],
    color: "green"
  },
  {
    id: "wsf_club_owners",
    title: "Club Owners",
    subtitle: "Management Network",
    visibility: "private",
    access: "Club owners & managers",
    notes: "Business and management discussions",
    features: ["File sharing", "Best practices", "Networking"],
    color: "purple"
  },
  {
    id: "psa",
    title: "Provincial",
    subtitle: "Regional Coordination",
    visibility: "private",
    access: "Provincial association members",
    notes: "Country-specific provincial discussions",
    features: ["Regional updates", "Coordination", "Local events"],
    color: "orange"
  },
  {
    id: "nsa",
    title: "National",
    subtitle: "Country Leadership",
    visibility: "private",
    access: "National association members",
    notes: "Country-level strategy and planning",
    features: ["National strategy", "Cross-regional", "Policy"],
    color: "red"
  },
  {
    id: "wsf_committee",
    title: "WSF Committee",
    subtitle: "Global Leadership",
    visibility: "private",
    access: "WSF leadership only",
    features: ["File sharing", "Strategic planning", "Decision making"],
    color: "amber"
  },
];

// Get icon for chatroom
export const getChatroomIcon = (type: ChatroomType): LucideIcon => {
  const icons = {
    wsf_fans: Users,
    wsf_students: GraduationCap,
    wsf_club_owners: Building2,
    psa: MapPin,
    nsa: Globe,
    wsf_committee: Shield
  };
  return icons[type];
};

export const getColorClass = (color: string) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return colors[color] || "bg-primary/10 text-primary";
};

export const visibilityCopy = {
  public: "Open Access",
  private: "Restricted",
} as const;