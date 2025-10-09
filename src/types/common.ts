// Common primitives and generic API envelope

export type ISODateTime = string; // e.g., 2025-09-13T12:34:56
export type YMDDate = string; // e.g., 2025-09-13

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

