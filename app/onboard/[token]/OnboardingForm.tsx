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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Details submitted successfully
        </h2>
        <p className="text-gray-500 text-sm">
          Thanks! Your details have been submitted. Your IT team will be in
          touch before your start date.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Personal details */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Employee details
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="employeeFirstName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="employeeFirstName"
              name="employeeFirstName"
              type="text"
              required
              value={fields.employeeFirstName}
              onChange={handleChange}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Jane"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="employeeLastName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              id="employeeLastName"
              name="employeeLastName"
              type="text"
              required
              value={fields.employeeLastName}
              onChange={handleChange}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Smith"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="employeeEmail"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Work email address <span className="text-red-500">*</span>
          </label>
          <input
            id="employeeEmail"
            name="employeeEmail"
            type="email"
            required
            value={fields.employeeEmail}
            onChange={handleChange}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="jane.smith@example.com"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="jobTitle"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Job title <span className="text-red-500">*</span>
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              type="text"
              required
              value={fields.jobTitle}
              onChange={handleChange}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Office Manager"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="department"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Department
            </label>
            <input
              id="department"
              name="department"
              type="text"
              value={fields.department}
              onChange={handleChange}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Adminstration"
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Start date <span className="text-red-500">*</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={fields.startDate}
            onChange={handleChange}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            disabled={submitting}
          />
        </div>
      </fieldset>

      {/* Hardware */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Hardware requirements
        </legend>

        <div className="flex items-start gap-3">
          <input
            id="needsHardware"
            name="needsHardware"
            type="checkbox"
            checked={fields.needsHardware}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
            <label
              htmlFor="hardwareDetails"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Hardware details
            </label>
            <textarea
              id="hardwareDetails"
              name="hardwareDetails"
              rows={3}
              value={fields.hardwareDetails}
              onChange={handleChange}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y"
              placeholder="e.g. Dell Laptop, external monitor, keyboard, mouse"
              disabled={submitting}
            />
          </div>
        )}
      </fieldset>

      {/* Software and additional info */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Software and additional information
        </legend>

        <div>
          <label
            htmlFor="softwareNeeded"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Software needed
          </label>
          <textarea
            id="softwareNeeded"
            name="softwareNeeded"
            rows={3}
            value={fields.softwareNeeded}
            onChange={handleChange}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y"
            placeholder="e.g. Microsoft 365 account, etc. Please specify permissions if possible. Site visibilities, access levels, etc."
            disabled={submitting}
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Additional notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={fields.notes}
            onChange={handleChange}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y"
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
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Submitting..." : "Submit onboarding details"}
        </button>
      </div>
    </form>
  );
}
