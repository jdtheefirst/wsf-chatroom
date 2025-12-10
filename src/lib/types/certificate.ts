// lib/validations/certificate.ts
import { z } from "zod";

export const certificateIssuanceSchema = z.object({
  admission_no: z
    .string()
    .min(1, "Admission number is required")
    .regex(
      /^WSF\d+$/,
      "Admission number must start with WSF followed by numbers"
    ),
  belt_name: z.string().min(1, "Belt level is required"),
  instructor_name: z.string().min(1, "Instructor name is required"),
  exam_score: z.coerce
    .number()
    .min(0, "Exam score must be at least 0")
    .max(100, "Exam score cannot exceed 100")
    .optional()
    .or(z.literal("")),
  practical_score: z.coerce
    .number()
    .min(0, "Practical score must be at least 0")
    .max(100, "Practical score cannot exceed 100")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
  live_session_id: z.string().optional(),
});

export type CertificateIssuanceFormData = z.infer<
  typeof certificateIssuanceSchema
>;
