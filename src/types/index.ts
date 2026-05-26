// Re-export Prisma types used across the app
export type {
  Clinic,
  Doctor,
  Verification,
  Alert,
  ErWaitTime,
  Pharmacy,
  DoctorType,
  AcceptingStatus,
} from "@prisma/client";

// API response types
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
}
