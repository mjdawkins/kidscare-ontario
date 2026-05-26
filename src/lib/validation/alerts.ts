import { z } from "zod";

export const alertCreateSchema = z.object({
  alert_type: z.literal("doctor"),
  target_id: z.string().uuid().optional(),
  postal_code: z.string().regex(/^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/).optional(),
  radius_km: z.number().int().min(5).max(50).default(10),
  doctor_type_filter: z.enum(["pediatrician_primary", "family_doctor"]).optional(),
  language_filter: z.string().max(50).optional(),
}).strict().refine(
  (data) => data.target_id || data.postal_code,
  { message: "Either target_id or postal_code is required" }
);

export type AlertCreateInput = z.infer<typeof alertCreateSchema>;
