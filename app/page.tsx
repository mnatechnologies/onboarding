import { FormShell } from "./components/Brand";

// Apex of the onboarding subdomain. Real users always arrive via a tokenised
// /onboard/[token] link emailed to them, so this is just a branded explainer for
// anyone who lands on the root host directly.
export default function Home() {
  return (
    <FormShell>
      <div className="mx-auto w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 sm:p-10 text-center">
        <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Employee onboarding
        </h1>
        <p className="text-gray-500 text-[15px] leading-relaxed mb-8">
          This is the secure onboarding portal for{" "}
          <span className="font-medium text-gray-700">MNA Technologies</span>{" "}
          clients. To complete an onboarding, please use the personalised link
          emailed to you. If you can&apos;t find it, contact your IT team.
        </p>
        <a
          href="https://mnatechnologies.com.au"
          className="btn-primary"
        >
          Visit mnatechnologies.com.au
        </a>
      </div>
    </FormShell>
  );
}
