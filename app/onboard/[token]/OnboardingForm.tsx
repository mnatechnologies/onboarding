"use client";

import { useState } from "react";

interface OnboardingFormProps {
  token: string;
}

interface FormFields {
  employeeFirstName: string;
  employeeLastName: string;
  employeeEmail: string;
  jobTitle: string;
  department: string;
  startDate: string;
  needsHardware: boolean;
  hardwareDetails: string;
  softwareNeeded: string;
  notes: string;
}

const INITIAL_FIELDS: FormFields = {
  employeeFirstName: "",
  employeeLastName: "",
  employeeEmail: "",
  jobTitle: "",
  department: "",
  startDate: "",
  needsHardware: false,
  hardwareDetails: "",
  softwareNeeded: "",
  notes: "",
};

// MNAWeb input idiom — defined once so every field stays visually identical.
const FIELD_CLASS =
  "w-full px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500";
const LABEL_CLASS = "block text-sm font-medium text-gray-700 mb-2";
const LEGEND_CLASS =
  "text-[#0066cc] font-semibold text-sm uppercase tracking-wider";

export default function OnboardingForm({ token }: OnboardingFormProps) {
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      setFields((prev) => ({ ...prev, [target.name]: target.checked }));
    } else {
      setFields((prev) => ({ ...prev, [target.name]: target.value }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...fields }),
      });

      if (res.ok) {
        setDone(true);
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          body.error ?? `Submission failed (HTTP ${res.status}). Please try again.`
        );
      }
    } catch {
      setError("A network error occurred. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-7 h-7 text-green-600"
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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Details submitted successfully
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Thanks! Your details have been submitted. Your IT team will be in
          touch before your start date.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Personal details */}
      <fieldset className="space-y-4">
        <legend className={LEGEND_CLASS}>Employee details</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="employeeFirstName" className={LABEL_CLASS}>
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="employeeFirstName"
              name="employeeFirstName"
              type="text"
              required
              value={fields.employeeFirstName}
              onChange={handleChange}
              className={FIELD_CLASS}
              placeholder="Jane"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="employeeLastName" className={LABEL_CLASS}>
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              id="employeeLastName"
              name="employeeLastName"
              type="text"
              required
              value={fields.employeeLastName}
              onChange={handleChange}
              className={FIELD_CLASS}
              placeholder="Smith"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label htmlFor="employeeEmail" className={LABEL_CLASS}>
            Work email address <span className="text-red-500">*</span>
          </label>
          <input
            id="employeeEmail"
            name="employeeEmail"
            type="email"
            required
            value={fields.employeeEmail}
            onChange={handleChange}
            className={FIELD_CLASS}
            placeholder="jane.smith@example.com"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="jobTitle" className={LABEL_CLASS}>
              Job title <span className="text-red-500">*</span>
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              type="text"
              required
              value={fields.jobTitle}
              onChange={handleChange}
              className={FIELD_CLASS}
              placeholder="Office Manager"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="department" className={LABEL_CLASS}>
              Department
            </label>
            <input
              id="department"
              name="department"
              type="text"
              value={fields.department}
              onChange={handleChange}
              className={FIELD_CLASS}
              placeholder="Administration"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label htmlFor="startDate" className={LABEL_CLASS}>
            Start date <span className="text-red-500">*</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={fields.startDate}
            onChange={handleChange}
            className={FIELD_CLASS}
            disabled={submitting}
          />
        </div>
      </fieldset>

      {/* Hardware */}
      <fieldset className="space-y-4">
        <legend className={LEGEND_CLASS}>Hardware requirements</legend>

        <div className="flex items-start gap-3">
          <input
            id="needsHardware"
            name="needsHardware"
            type="checkbox"
            checked={fields.needsHardware}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0066cc] focus:ring-[#0066cc]"
            disabled={submitting}
          />
          <label
            htmlFor="needsHardware"
            className="text-sm text-gray-700 cursor-pointer"
          >
            This employee requires hardware (laptop, peripherals, etc.)
          </label>
        </div>

        {fields.needsHardware && (
          <div>
            <label htmlFor="hardwareDetails" className={LABEL_CLASS}>
              Hardware details
            </label>
            <textarea
              id="hardwareDetails"
              name="hardwareDetails"
              rows={3}
              value={fields.hardwareDetails}
              onChange={handleChange}
              className={`${FIELD_CLASS} resize-y`}
              placeholder="e.g. Dell Laptop, external monitor, keyboard, mouse"
              disabled={submitting}
            />
          </div>
        )}
      </fieldset>

      {/* Software and additional info */}
      <fieldset className="space-y-4">
        <legend className={LEGEND_CLASS}>
          Software and additional information
        </legend>

        <div>
          <label htmlFor="softwareNeeded" className={LABEL_CLASS}>
            Software needed
          </label>
          <textarea
            id="softwareNeeded"
            name="softwareNeeded"
            rows={3}
            value={fields.softwareNeeded}
            onChange={handleChange}
            className={`${FIELD_CLASS} resize-y`}
            placeholder="e.g. Microsoft 365 account, etc. Please specify permissions if possible. Site visibilities, access levels, etc."
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="notes" className={LABEL_CLASS}>
            Additional notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={fields.notes}
            onChange={handleChange}
            className={`${FIELD_CLASS} resize-y`}
            placeholder="Any other information the IT team should know"
            disabled={submitting}
          />
        </div>
      </fieldset>

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-[#0066cc] text-white font-semibold rounded-lg hover:bg-[#0052a3] transition-colors shadow-lg shadow-blue-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit onboarding details"}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          Your information is sent securely to the MNA Technologies IT team.
        </p>
      </div>
    </form>
  );
}
