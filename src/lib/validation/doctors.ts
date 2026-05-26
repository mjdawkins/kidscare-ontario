import { z } from "zod";

export const doctorSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(50).default(10),
  doctor_type: z.enum([
    "pediatrician_primary",
    "pediatrician_specialist",
    "family_doctor",
  ]).optional(),
  accepting_status: z.enum([
    "accepting",
    "waitlist",
    "not_accepting",
    "unknown",
  ]).optional(),
  referral_required: z.coerce.boolean().optional(),
  language: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const verificationSchema = z.object({
  reported_status: z.enum(["accepting", "waitlist", "not_accepting"]),
  how_confirmed: z.enum([
    "called_office",
    "visited_in_person",
    "received_appointment",
    "told_by_receptionist",
  ]),
  notes: z.string().max(500).optional(),
}).strict();

export type DoctorSearchInput = z.infer<typeof doctorSearchSchema>;
export type VerificationInput = z.infer<typeof verificationSchema>;
