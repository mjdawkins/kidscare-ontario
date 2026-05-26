import { z } from "zod";

export const clinicSearchSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(50).default(10),
  open_now: z.coerce.boolean().optional(),
  sees_children: z.coerce.boolean().optional(),
  open_saturday: z.coerce.boolean().optional(),
  open_sunday: z.coerce.boolean().optional(),
  open_after_6pm: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const clinicFlagSchema = z.object({
  reason: z.enum([
    "hours_wrong",
    "address_wrong",
    "closed_permanently",
    "no_longer_sees_children",
    "other",
  ]),
  note: z.string().max(500).optional(),
}).strict();

export type ClinicSearchInput = z.infer<typeof clinicSearchSchema>;
export type ClinicFlagInput = z.infer<typeof clinicFlagSchema>;
