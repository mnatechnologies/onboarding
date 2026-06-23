export const runtime = "nodejs";

import { verifyToken } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabase";
import { STATUS, type OnboardingRun } from "@/lib/onboarding";
import { FormShell } from "@/app/components/Brand";
import OnboardingForm from "./OnboardingForm";

const ALREADY_RECEIVED_STATUSES: string[] = [
  STATUS.FORM_RECEIVED,
  STATUS.PROVISIONED,
  STATUS.COMPLETE,
];

function StatusCard({
  tone,
  title,
  message,
}: {
  tone: "error" | "success";
  title: string;
  message: string;
}) {
  const icon =
    tone === "error" ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    );
  const ring =
    tone === "error"
      ? "bg-red-100 text-red-600"
      : "bg-green-100 text-green-600";

  return (
    <div className="mx-auto w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
      <div
        className={`w-12 h-12 ${ring} rounded-full flex items-center justify-center mx-auto mb-4`}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
    </div>
  );
}

export default async function Page(props: PageProps<"/onboard/[token]">) {
  const { token } = await props.params;

  // Verify HMAC signature — do NOT call notFound() for invalid token
  const decoded = verifyToken(token);
  if (!decoded) {
    return (
      <FormShell>
        <StatusCard
          tone="error"
          title="Invalid or expired link"
          message="This link is invalid or has expired. Please contact your IT team for a new onboarding link."
        />
      </FormShell>
    );
  }

  // Look up the onboarding run in the database
  const { data: row } = await supabaseAdmin()
    .from("onboarding_runs")
    .select("*")
    .eq("token", token)
    .maybeSingle<OnboardingRun>();

  if (!row) {
    return (
      <FormShell>
        <StatusCard
          tone="error"
          title="Invalid or expired link"
          message="This link is invalid or has expired. Please contact your IT team for a new onboarding link."
        />
      </FormShell>
    );
  }

  // If the form has already been submitted, show confirmation instead of the form
  if (ALREADY_RECEIVED_STATUSES.includes(row.status)) {
    return (
      <FormShell>
        <StatusCard
          tone="success"
          title="Details already received"
          message="Thanks — we have already received your onboarding details. Your IT team will be in touch before your start date."
        />
      </FormShell>
    );
  }

  return (
    <FormShell>
      <div className="mb-8 text-center sm:text-left">
        <span className="text-[#0066cc] font-semibold text-sm uppercase tracking-wider">
          Welcome to the team
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
          New employee onboarding
        </h1>
        <p className="text-gray-500 mt-2 text-[15px] leading-relaxed">
          Please fill in the details below so we can set up everything before
          your start date.
        </p>
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
        <OnboardingForm token={token} />
      </div>
    </FormShell>
  );
}
