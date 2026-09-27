import type { Role, Vendor } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `authenticate`. */
      user?: { id: string; role: Role };
      /** Populated by `requireApprovedVendor`. */
      vendor?: Vendor;
      /** Parsed output of the route's Zod schema (see `validate`). */
      valid?: unknown;
      /** Raw request body, captured for webhook signature verification. */
      rawBody?: Buffer;
    }
  }
}

export {};
