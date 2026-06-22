export const runtime = "nodejs";

import { verifyToken } from "@/lib/token";
import { supabaseAdmin } from "@/lib/supabase";
import { STATUS, type OnboardingRun } from "@/lib/onboarding";
import OnboardingForm from "./OnboardingForm";

const ALREADY_RECEIVED_STATUSES: string[] = [
  STATUS.FORM_RECEIVED,
  STATUS.PROVISIONED,
  STATUS.COMPLETE,
];

function InvalidLinkCard() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Invalid or expired link
        </h1>
        <p className="text-gray-500 text-sm">
          This link is invalid or has expired. Please contact your IT team for a
          new onboarding link.
        </p>
      </div>
    </div>
  );
}

function AlreadyReceivedCard() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Details already received
        </h1>
        <p className="text-gray-500 text-sm">
          Thanks — we have already received your onboarding details. Your IT
          team will be in touch before your start date.
        </p>
      </div>
    </div>
  );
}

export default async function Page(
  props: PageProps<"/onboard/[token]">
) {
  const { token } = await props.params;

  // Verify HMAC signature — do NOT call notFound() for invalid token
  const decoded = verifyToken(token);
  if (!decoded) {
    return <InvalidLinkCard />;
  }

  // Look up the onboarding run in the database
  const { data: row } = await supabaseAdmin()
    .from("onboarding_runs")
    .select("*")
    .eq("token", token)
    .maybeSingle<OnboardingRun>();

  if (!row) {
    return <InvalidLinkCard />;
  }

  // If the form has already been submitted, show confirmation instead of the form
  if (ALREADY_RECEIVED_STATUSES.includes(row.status)) {
    return <AlreadyReceivedCard />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            New employee onboarding
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Please fill in the details below so we can set up everything before
            your start date.
          </p>
        </div>
        <OnboardingForm token={token} />
      </div>
    </div>
  );
}
