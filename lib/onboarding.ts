/**
 * Shared onboarding domain types, the status state machine, and the zod
 * schema for the client-submitted form payload.
 *
 *   new ──> form_sent ──> form_received ──> provisioned ──> complete
 *                    └──────────> error (side state, cron retries)
 */

import { z } from "zod";

export const STATUS = {
  NEW: "new",
  FORM_SENT: "form_sent",
  FORM_RECEIVED: "form_received",
  PROVISIONED: "provisioned",
  COMPLETE: "complete",
  ERROR: "error",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

/** A row of the `onboarding_runs` table. */
export interface OnboardingRun {
  id: string;
  ticket_id: number;
  company_id: number;
  contact_email: string | null;
  token: string;
  status: Status;
  payload: OnboardingPayload | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What the client fills in. Kept deliberately small and representative — the
 * fields a downstream requisition / provisioning task needs pre-filled.
 */
export const onboardingPayloadSchema = z.object({
  employeeFirstName: z.string().trim().min(1, "First name is required").max(100),
  employeeLastName: z.string().trim().min(1, "Last name is required").max(100),
  employeeEmail: z.string().trim().email("A valid email is required").max(200),
  jobTitle: z.string().trim().min(1, "Job title is required").max(150),
  department: z.string().trim().max(150).optional().default(""),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  // Drives whether a requisition task is created.
  needsHardware: z.boolean(),
  hardwareDetails: z.string().trim().max(2000).optional().default(""),
  softwareNeeded: z.string().trim().max(2000).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

/** The submit endpoint accepts the token alongside the form fields. */
export const submitRequestSchema = onboardingPayloadSchema.extend({
  token: z.string().min(1),
});

export type SubmitRequest = z.infer<typeof submitRequestSchema>;
