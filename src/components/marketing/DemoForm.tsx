"use client";

import { track } from "@vercel/analytics";
import { useActionState, useEffect, useRef } from "react";
import { submitDemoRequest } from "@/app/(marketing)/demo/actions";
import { demoForm, roles, sports, thankYou, tvOptions } from "@/content/demo";
import {
  HONEYPOT_FIELD,
  initialDemoFormState,
  type LeadField,
} from "@/lib/leads";
import { PlaceholderTag } from "./ui";

const inputClass =
  "mt-2 min-h-14 w-full rounded-2xl border-2 border-charcoal bg-white px-4 text-lg text-charcoal placeholder:text-charcoal/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato aria-invalid:border-tomato";
const labelClass = "block font-display text-lg font-semibold uppercase tracking-wide";

export function DemoForm() {
  const [state, formAction, pending] = useActionState(
    submitDemoRequest,
    initialDemoFormState,
  );
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const { labels, placeholders, errors } = demoForm;
  const values = state.values;

  useEffect(() => {
    if (state.status === "success") {
      track("demo_form_submit");
      thanksRef.current?.focus();
    }
    // Bring the error message into view; the submit button sits below the fields.
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="rounded-3xl border-2 border-charcoal bg-gold p-6 sm:p-8">
        <h2
          ref={thanksRef}
          tabIndex={-1}
          className="font-display text-4xl font-bold uppercase outline-none sm:text-5xl"
        >
          {thankYou.headline}
        </h2>
        <p className="mt-3 text-lg">{thankYou.body}</p>
        <h3 className="mt-6 font-display text-xl font-semibold uppercase">
          What happens next {thankYou.placeholder && <PlaceholderTag />}
        </h3>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-lg">
          {thankYou.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    );
  }

  const fieldError = (field: LeadField) => {
    const code = state.fieldErrors?.[field];
    return code ? errors[code] : undefined;
  };

  const errorProps = (field: LeadField) =>
    fieldError(field)
      ? { "aria-invalid": true, "aria-describedby": `${field}-error` }
      : {};

  const errorText = (field: LeadField) =>
    fieldError(field) ? (
      <p id={`${field}-error`} className="mt-1 font-semibold text-tomato">
        {fieldError(field)}
      </p>
    ) : null;

  return (
    <form
      action={formAction}
      noValidate
      className="grid gap-5 rounded-3xl border-2 border-charcoal bg-cream-200 p-5 sm:p-8"
    >
      {state.status === "error" && state.error && (
        <p
          role="alert"
          ref={alertRef}
          tabIndex={-1}
          className="scroll-mt-6 rounded-2xl border-2 border-tomato bg-white px-4 py-3 font-semibold text-tomato"
        >
          {errors[state.error]}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            {labels.name}
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={values?.name}
            className={inputClass}
            {...errorProps("name")}
          />
          {errorText("name")}
        </div>
        <div>
          <label htmlFor="barName" className={labelClass}>
            {labels.barName}
          </label>
          <input
            id="barName"
            name="barName"
            autoComplete="organization"
            required
            defaultValue={values?.barName}
            className={inputClass}
            {...errorProps("barName")}
          />
          {errorText("barName")}
        </div>
        <div>
          <label htmlFor="cityState" className={labelClass}>
            {labels.cityState}
          </label>
          <input
            id="cityState"
            name="cityState"
            placeholder={placeholders.cityState}
            required
            defaultValue={values?.cityState}
            className={inputClass}
            {...errorProps("cityState")}
          />
          {errorText("cityState")}
        </div>
        <div>
          <label htmlFor="role" className={labelClass}>
            {labels.role}
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue={values?.role ?? ""}
            className={inputClass}
            {...errorProps("role")}
          >
            <option value="" disabled>
              Choose one
            </option>
            {roles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          {errorText("role")}
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            {labels.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={values?.email}
            className={inputClass}
            {...errorProps("email")}
          />
          {errorText("email")}
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            {labels.phone}{" "}
            <span className="font-sans text-sm font-normal normal-case tracking-normal text-charcoal/75">
              (optional)
            </span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={values?.phone}
            className={inputClass}
            {...errorProps("phone")}
          />
          {errorText("phone")}
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>{labels.sports}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sports.map((sport) => (
            <label
              key={sport}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-charcoal bg-white px-4 text-base has-checked:bg-gold"
            >
              <input
                type="checkbox"
                name="sports"
                value={sport}
                defaultChecked={values?.sports.includes(sport)}
                className="size-5 accent-tomato"
              />
              {sport}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="tvCount" className={labelClass}>
          {labels.tvs}
        </label>
        <select
          id="tvCount"
          name="tvCount"
          defaultValue={values?.tvCount ?? ""}
          className={`${inputClass} sm:max-w-xs`}
        >
          <option value="">Choose one</option>
          {tvOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          {labels.notes}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={2000}
          placeholder={placeholders.notes}
          defaultValue={values?.notes}
          className={`${inputClass} py-3`}
        />
      </div>

      {/* Honeypot: hidden from people and assistive tech; only bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Leave this field empty</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-tomato px-7 font-display text-lg font-semibold uppercase tracking-wide text-cream transition-colors hover:bg-tomato-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal disabled:opacity-60 sm:w-auto"
        >
          {pending ? demoForm.submitting : demoForm.submit}
        </button>
        <p className="mt-3 text-sm text-charcoal/70">{demoForm.consent}</p>
      </div>
    </form>
  );
}
