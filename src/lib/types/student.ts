// src/lib/types/student.ts
import { z } from "zod";

export const StudentSchema = z
  .object({
    referred_by: z
      .string()
      .min(3, "Referrer must be at least 3 characters")
      .max(30, "Referrer must be under 30 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Only lowercase letters, numbers, and underscores allowed"
      )
      .optional()
      .or(z.literal("")),
    email: z.email(),
    full_name: z.string(),
    avatar_url: z.string().optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional(),
    confirmPassword: z.string().optional(),
    gender: z.string().optional(),
    belt_level: z.number().optional(),
    country_code: z.string().min(2).max(100),
    county_code: z.string().min(2).max(100),
    phone_number: z.string().optional().or(z.literal("")),
    language: z.string().optional(),
    postal_address: z.string().min(3, "Address must be at least 3 characters"),
    admission_no: z.string().optional(),
  })
  .refine((data) => !data.password || data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type Student = z.infer<typeof StudentSchema>;

// Use the same type for ProfileData to avoid inconsistencies
export type Profile = Omit<Student, "password" | "confirmPassword">;

// Or if you prefer the interface approach, make sure it matches exactly:
export interface ProfileData {
  id?: string;
  email: string;
  full_name: string;
  country_code: string;
  county_code: string;
  postal_address: string;
  phone_number?: string; // Make optional to match Student type
  avatar_url?: string;
  language?: string;
  gender?: string;
  admission_no?: string;
  belt_level: number;
  role: string;
  referred_by?: string;
}

export interface ClubMembership {
  clubs: {
    id: string;
    name: string;
    slug: string;
    country_code: string;
    logo_url: string;
  };
  membership_type: string;
}

export interface AssociationMembership {
  associations: {
    id: string;
    name: string;
    slug: string;
    country_code: string;
    county_code: string;
    logo_url: string;
  };
  role: string;
}

export interface CoachingRole {
  clubs: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
  display_name: string;
  bio: string;
  public_phone: string;
  public_email: string;
  is_public: boolean;
}
