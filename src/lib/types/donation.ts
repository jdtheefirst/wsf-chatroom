export interface Patron {
  id: string;
  name: string;
  admissionNo?: string;
  amount: number;
  currency: string;
  message?: string;
  country?: string;
  campaign?: string;
  campaignSlug?: string;
  campaignId?: string;
  isAnonymous: boolean;
  date: string;
}

export interface PatronsSectionProps {
  title: string;
  description: string;
  patrons: Patron[];
  icon: React.ReactNode;
  variant?: "celebrated" | "recent";
  disabled?: boolean;
}
