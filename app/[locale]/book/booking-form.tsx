"use client";

import { useActionState, useCallback, useRef, useState } from "react";

import { TimeSlotPicker } from "@/components/booking/time-slot-picker";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

import type { BookingFormState } from "./actions";
import type { PrefillErrorCode, PrefillResult } from "@/lib/ai/prefill";

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
  locale?: string;
}>;

async function callPrefillApi(
  locale: string,
  description: string,
): Promise<PrefillResult> {
  const res = await fetch("/api/ai/prefill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, description }),
  });

  if (res.status === 429) return { ok: false, error: "rateLimited" };
  if (res.status === 413) return { ok: false, error: "tooLong" };
  if (res.status === 503) return { ok: false, error: "disabled" };

  if (!res.ok) return { ok: false, error: "aiError" };

  return res.json() as Promise<PrefillResult>;
}

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
  const showPrefill = !!prefillCopy && !!locale;

  const handlePrefill = useCallback(async () => {
    if (!locale || !prefillCopy) return;

    setPrefillError(null);
    setPrefillLoading(true);

    try {
      const result = await callPrefillApi(locale, prefillText);

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
  }, [locale, prefillText, prefillCopy, copy.serviceType.options]);

  return (
    <form ref={formRef} action={formAction} className="mt-10">
      <Card>
        {showPrefill ? (
          <div className="mb-8 rounded-2xl border border-primary/30 bg-primary-light p-5">
            <p className="text-sm font-bold text-foreground/90">
              {prefillCopy.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {prefillCopy.description}
            </p>
            <Textarea
              className="mt-3 w-full bg-surface-elevated"
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
            <Button
              className="mt-3"
              disabled={prefillLoading || !prefillText.trim()}
              onClick={handlePrefill}
              size="sm"
            >
              {prefillLoading ? prefillCopy.loading : prefillCopy.button}
            </Button>
          </div>
        ) : null}

        <fieldset className="mb-8">
          <legend className="text-sm font-bold text-foreground/90">
            {copy.serviceType.label}
            <span className="ml-1 text-primary">{copy.required}</span>
          </legend>
          <p className="mt-2 text-sm leading-6 text-muted">
            {copy.serviceType.description}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {serviceTypes.map((serviceType) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 transition hover:border-primary hover:bg-primary-light"
                key={serviceType}
              >
                <input
                  className="mt-1 size-4 accent-primary"
                  name="serviceType"
                  required
                  type="radio"
                  value={copy.serviceType.options[serviceType].value}
                />
                <span>
                  <span className="block text-sm font-black">
                    {copy.serviceType.options[serviceType].label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted">
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
            <div
              className={[
                "grid gap-2",
                field === "problemDescription" ? "md:col-span-2" : "",
              ].join(" ")}
              key={field}
            >
              <Label htmlFor={field} required requiredText={copy.required}>
                {copy.fields[field].label}
              </Label>
              {field === "problemDescription" ? (
                <Textarea
                  id={field}
                  name={field}
                  placeholder={copy.fields[field].placeholder}
                  required
                />
              ) : (
                <Input
                  id={field}
                  name={field}
                  placeholder={copy.fields[field].placeholder}
                  required
                  type={inputTypes[field] ?? "text"}
                />
              )}
            </div>
          ))}

          {optionalFields.map((field) => (
            <div
              className={[
                "grid gap-2",
                field === "clientNotes" ? "md:col-span-2" : "",
              ].join(" ")}
              key={field}
            >
              <Label htmlFor={field} optional optionalText={copy.optional}>
                {copy.fields[field].label}
              </Label>
              {field === "clientNotes" ? (
                <Textarea
                  className="min-h-28"
                  id={field}
                  name={field}
                  placeholder={copy.fields[field].placeholder}
                />
              ) : (
                <Input
                  id={field}
                  name={field}
                  placeholder={copy.fields[field].placeholder}
                  type="text"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-surface p-4 text-sm leading-6 text-muted">
          {copy.reviewNotice}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button disabled={isPending} type="submit">
            {copy.cta}
          </Button>
          <p className="text-sm leading-6 text-muted">{copy.ctaNote}</p>
        </div>
      </Card>
    </form>
  );
}
