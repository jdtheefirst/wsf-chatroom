export interface Campaign {
  id: string;
  title: string;
  description: string;
  short_description: string;
  long_description: string;
  goal: number;
  raised: number;
  donors_count: number;
  location: string;
  image_url?: string;
  category: string;
  urgency: "low" | "medium" | "high" | "critical";
  deadline: string | null;
  features: string[];
  slug: string;
  featured: boolean;
  updates?: {
    id: string;
    date: string;
    title: string;
    content: string;
    type: "milestone" | "progress" | "donation" | "partnership" | "general";
  }[];
  why_support: {
    icon: string;
    title: string;
    description: string;
  }[];

  created_at: string;
}
