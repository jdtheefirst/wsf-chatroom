// lib/validations/contact.ts
import { z } from "zod";

// Base contact schema with ALL possible fields as optional
export const baseContactSchema = z.object({
  // Common fields
  type: z.enum([
    "club_membership",
    "club_inquiry",
    "start_club",
    "association_membership",
    "start_association",
    "organize_event",
    "general_inquiry",
  ]),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),

  // Association/Club fields
  admissionNo: z.string().optional(),
  beltLevel: z.number().optional(),
  country: z.string().optional(),
  county: z.string().optional(),
  association: z.string().optional(),
  club: z.string().optional(),

  // Club-specific
  clubName: z.string().optional(),

  // Event-specific
  eventTitle: z.string().optional(),
  eventDate: z.string().optional(),
  eventDescription: z.string().optional(),
});

// Now extend with specific validations for each type
export const clubMembershipSchema = baseContactSchema.extend({
  type: z.literal("club_membership"),
  club: z.string().min(1, "Club is required"),
});

export const clubInquirySchema = baseContactSchema.extend({
  type: z.literal("club_inquiry"),
  club: z.string().min(1, "Club is required"),
});

export const startClubSchema = baseContactSchema.extend({
  type: z.literal("start_club"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  admissionNo: z.string().min(10, "Valid admission number is required"),
  beltLevel: z.number().min(7, "Must be black belt (level 7+) to start a club"),
  clubName: z.string().min(2, "Club name must be at least 2 characters"),
  country: z
    .string()
    .length(2, "Country code must be 2 characters")
    .toUpperCase(),
  county: z.string().min(1, "County/Province is required"),
});

export const associationMembershipSchema = baseContactSchema.extend({
  type: z.literal("association_membership"),
  association: z.string().min(1, "Association is required"),
});

export const startAssociationSchema = baseContactSchema.extend({
  type: z.literal("start_association"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  admissionNo: z.string().min(10, "Valid admission number is required"),
  beltLevel: z.number().min(7, "Must be black belt or higher"),
  country: z
    .string()
    .length(2, "Country code must be 2 characters")
    .toUpperCase(),
  associationType: z.enum(["national", "provincial"]).optional(),
});

export const organizeEventSchema = baseContactSchema.extend({
  type: z.literal("organize_event"),
  eventTitle: z.string().min(5, "Event title must be at least 5 characters"),
  eventDescription: z
    .string()
    .min(20, "Event description must be at least 20 characters"),
});

export const generalInquirySchema = baseContactSchema.extend({
  type: z.literal("general_inquiry"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
});

// Union type for all contact types
export const contactFormSchema = z.discriminatedUnion("type", [
  clubMembershipSchema,
  clubInquirySchema,
  startClubSchema,
  associationMembershipSchema,
  startAssociationSchema,
  organizeEventSchema,
  generalInquirySchema,
]);

export type ContactFormData = z.infer<typeof contactFormSchema>;
