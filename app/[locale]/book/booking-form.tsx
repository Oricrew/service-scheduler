"use client";

import { useActionState, useCallback, useRef, useState } from "react";

import { TimeSlotPicker } from "@/components/booking/time-slot-picker";

import type {
  BookingFormState,
  PrefillErrorCode,
  PrefillResult,
} from "./actions";

const initialBookingFormState: BookingFormState = {
  error: null,
};

const serviceTypes = [
  "repair",
  "maintenance",
  "installation",
  "quotationInspection",
  "emergencyService",
] as const;

const requiredFields = [
  "name",
  "phone",
  "email",
  "address",
  "city",
  "equipmentType",
  "problemDescription",
] as const;

const optionalFields = ["brandModel", "clientNotes"] as const;

const inputTypes: Partial<Record<(typeof requiredFields)[number], string>> = {
  email: "email",
  phone: "tel",
};

const slugToFormValue: Record<string, (typeof serviceTypes)[number]> = {
  repair: "repair",
  maintenance: "maintenance",
  installation: "installation",
  "quotation-inspection": "quotationInspection",
  "emergency-service": "emergencyService",
};

type PrefillCopy = {
  label: string;
  description: string;
  placeholder: string;
  button: string;
  loading: string;
  errors: Record<PrefillErrorCode, string>;
};

type BookingFormCopy = {
  required: string;
  optional: string;
  cta: string;
  ctaNote: string;
  reviewNotice: string;
  serviceType: {
    label: string;
    description: string;
    options: Record<
      (typeof serviceTypes)[number],
      { value: string; label: string; description: string }
    >;
  };
  timeSelection: {
    label: string;
    description: string;
    dateLabel: string;
    slotLabel: string;
    requiredLabel: string;
    noSlotsLabel: string;
    helperText: string;
  };
  fields: Record<
    (typeof requiredFields)[number] | (typeof optionalFields)[number],
    { label: string; placeholder: string }
  >;
  errors: {
    invalidDateTime: string;
  };
  prefill?: PrefillCopy;
};

type BookingFormProps = Readonly<{
  action: (
    previousState: BookingFormState,
    formData: FormData,
  ) => Promise<BookingFormState>;
  copy: BookingFormCopy;
  aiEnabled?: boolean;
  prefillAction?: (
    locale: string,
    description: string,
  ) => Promise<PrefillResult>;
  locale?: string;
}>;

function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
) {
  if (!el || !value) return;
  const setter = Object.getOwnPropertyDescriptor(
    el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function BookingForm({
  action,
  copy,
  aiEnabled,
  prefillAction,
  locale,
}: BookingFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialBookingFormState,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [prefillText, setPrefillText] = useState("");
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  const prefillCopy = aiEnabled ? copy.prefill : undefined;
  const showPrefill = !!prefillCopy && !!prefillAction && !!locale;

  const handlePrefill = useCallback(async () => {
    if (!prefillAction || !locale || !prefillCopy) return;

    setPrefillError(null);
    setPrefillLoading(true);

    try {
      const result = await prefillAction(locale, prefillText);

      if (!result.ok) {
        setPrefillError(prefillCopy.errors[result.error]);
        return;
      }

      const form = formRef.current;
      if (!form) return;
      const data = result.data;

      if (data.serviceSlug) {
        const formKey = slugToFormValue[data.serviceSlug];
        if (formKey) {
          const serviceOption = copy.serviceType.options[formKey];
          const radio = form.querySelector<HTMLInputElement>(
            `input[name="serviceType"][value="${serviceOption.value}"]`,
          );
          if (radio) radio.checked = true;
        }
      }

      if (data.city) {
        setNativeInputValue(
          form.querySelector<HTMLInputElement>('[name="city"]'),
          data.city,
        );
      }
      if (data.equipmentType) {
        setNativeInputValue(
          form.querySelector<HTMLInputElement>('[name="equipmentType"]'),
          data.equipmentType,
        );
      }
      if (data.problemDescription) {
        setNativeInputValue(
          form.querySelector<HTMLTextAreaElement>(
            '[name="problemDescription"]',
          ),
          data.problemDescription,
        );
      }
      if (data.brandModel) {
        setNativeInputValue(
          form.querySelector<HTMLInputElement>('[name="brandModel"]'),
          data.brandModel,
        );
      }
      if (data.clientNotes) {
        setNativeInputValue(
          form.querySelector<HTMLTextAreaElement>('[name="clientNotes"]'),
          data.clientNotes,
        );
      }
    } catch {
      setPrefillError(prefillCopy.errors.aiError);
    } finally {
      setPrefillLoading(false);
    }
  }, [
    prefillAction,
    locale,
    prefillText,
    prefillCopy,
    copy.serviceType.options,
  ]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-10 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8"
    >
      {showPrefill ? (
        <div className="mb-8 rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
          <p className="text-sm font-bold text-slate-800">
            {prefillCopy.label}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {prefillCopy.description}
          </p>
          <textarea
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            maxLength={500}
            onChange={(e) => setPrefillText(e.target.value)}
            placeholder={prefillCopy.placeholder}
            rows={3}
            value={prefillText}
          />
          {prefillError ? (
            <p className="mt-2 text-sm font-bold text-red-700">
              {prefillError}
            </p>
          ) : null}
          <button
            className="mt-3 rounded-full bg-sky-700 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={prefillLoading || !prefillText.trim()}
            onClick={handlePrefill}
            type="button"
          >
            {prefillLoading ? prefillCopy.loading : prefillCopy.button}
          </button>
        </div>
      ) : null}

      <fieldset className="mb-8">
        <legend className="text-sm font-bold text-slate-800">
          {copy.serviceType.label}
          <span className="ml-1 text-sky-700">{copy.required}</span>
        </legend>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {copy.serviceType.description}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {serviceTypes.map((serviceType) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50/50"
              key={serviceType}
            >
              <input
                className="mt-1 size-4 accent-sky-700"
                name="serviceType"
                required
                type="radio"
                value={copy.serviceType.options[serviceType].value}
              />
              <span>
                <span className="block text-sm font-black text-slate-900">
                  {copy.serviceType.options[serviceType].label}
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-500">
                  {copy.serviceType.options[serviceType].description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TimeSlotPicker
        dateLabel={copy.timeSelection.dateLabel}
        description={copy.timeSelection.description}
        helperText={copy.timeSelection.helperText}
        label={copy.timeSelection.label}
        noSlotsLabel={copy.timeSelection.noSlotsLabel}
        requiredLabel={copy.timeSelection.requiredLabel}
        slotLabel={copy.timeSelection.slotLabel}
      />

      {state.error ? (
        <p className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {copy.errors[state.error]}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {requiredFields.map((field) => (
          <label
            className={[
              "grid gap-2",
              field === "problemDescription" ? "md:col-span-2" : "",
            ].join(" ")}
            key={field}
          >
            <span className="text-sm font-bold text-slate-800">
              {copy.fields[field].label}
              <span className="ml-1 text-sky-700">{copy.required}</span>
            </span>
            {field === "problemDescription" ? (
              <textarea
                className="min-h-32 rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                name={field}
                placeholder={copy.fields[field].placeholder}
                required
              />
            ) : (
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                name={field}
                placeholder={copy.fields[field].placeholder}
                required
                type={inputTypes[field] ?? "text"}
              />
            )}
          </label>
        ))}

        {optionalFields.map((field) => (
          <label
            className={[
              "grid gap-2",
              field === "clientNotes" ? "md:col-span-2" : "",
            ].join(" ")}
            key={field}
          >
            <span className="text-sm font-bold text-slate-800">
              {copy.fields[field].label}
              <span className="ml-1 text-slate-500">{copy.optional}</span>
            </span>
            {field === "clientNotes" ? (
              <textarea
                className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                name={field}
                placeholder={copy.fields[field].placeholder}
              />
            ) : (
              <input
                className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                name={field}
                placeholder={copy.fields[field].placeholder}
                type="text"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-8 rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        {copy.reviewNotice}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isPending}
          type="submit"
        >
          {copy.cta}
        </button>
        <p className="text-sm leading-6 text-slate-500">{copy.ctaNote}</p>
      </div>
    </form>
  );
}
