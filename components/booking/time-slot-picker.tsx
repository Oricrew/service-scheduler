"use client";

import { useMemo, useState } from "react";

import { Input, Label } from "@/components/ui";

type TimeSlotPickerProps = Readonly<{
  label: string;
  description: string;
  dateLabel: string;
  slotLabel: string;
  requiredLabel: string;
  noSlotsLabel: string;
  helperText: string;
}>;

const weekdayHours = { start: 8, end: 18 };
const saturdayHours = { start: 9, end: 16 };

function getSlotsForDate(date: string) {
  if (!date) {
    return [];
  }

  const selectedDate = new Date(`${date}T00:00:00`);
  const day = selectedDate.getDay();

  if (day === 0) {
    return [];
  }

  const hours = day === 6 ? saturdayHours : weekdayHours;
  const slots: string[] = [];

  for (let hour = hours.start; hour < hours.end; hour += 1) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }

  return slots;
}

export function TimeSlotPicker({
  label,
  description,
  dateLabel,
  slotLabel,
  requiredLabel,
  noSlotsLabel,
  helperText,
}: TimeSlotPickerProps) {
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const slots = useMemo(() => getSlotsForDate(date), [date]);

  return (
    <fieldset className="mb-8">
      <legend className="text-sm font-bold text-foreground/90">
        {label}
        <span className="ml-1 text-primary">{requiredLabel}</span>
      </legend>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>

      <div className="mt-4 grid gap-2">
        <Label htmlFor="requestedDate" required requiredText={requiredLabel}>
          {dateLabel}
        </Label>
        <Input
          id="requestedDate"
          name="requestedDate"
          onChange={(event) => {
            setDate(event.target.value);
            setSelectedSlot("");
          }}
          required
          type="date"
          value={date}
        />
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-foreground/90">
          {slotLabel}
          <span className="ml-1 text-primary">{requiredLabel}</span>
        </p>

        {slots.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {slots.map((slot) => (
              <label
                className={[
                  "cursor-pointer rounded-2xl border px-4 py-3 text-center text-sm font-black transition",
                  selectedSlot === slot
                    ? "border-primary bg-primary-light text-foreground ring-4 ring-ring-focus"
                    : "border-border hover:border-primary hover:bg-primary-light",
                ].join(" ")}
                key={slot}
              >
                <input
                  checked={selectedSlot === slot}
                  className="sr-only"
                  name="requestedTime"
                  onChange={() => {
                    setSelectedSlot(slot);
                  }}
                  required
                  type="radio"
                  value={slot}
                />
                {slot}
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-surface p-4 text-sm leading-6 text-muted">
            {noSlotsLabel}
          </p>
        )}
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">{helperText}</p>
    </fieldset>
  );
}
