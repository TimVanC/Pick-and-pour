import { roles, sports, tvOptions } from "@/content/demo";

/** A validated demo request, ready to store. */
export type Lead = {
  name: string;
  barName: string;
  cityState: string;
  role: string;
  phone: string;
  email: string;
  sports: string[];
  tvCount: string;
  notes: string;
};

export type LeadField = keyof Lead;

export type LeadFieldError = "required" | "email" | "phone";

export type DemoFormState = {
  status: "idle" | "success" | "error";
  /** Which error message to show above the form. */
  error?: "invalid" | "rateLimited" | "generic";
  fieldErrors?: Partial<Record<LeadField, LeadFieldError>>;
  /** Echoed back so the form keeps what the visitor typed after an error. */
  values?: Lead;
};

export const initialDemoFormState: DemoFormState = { status: "idle" };

/** Name of the hidden honeypot input. Real visitors never fill it in. */
export const HONEYPOT_FIELD = "company_website";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(formData: FormData, key: string, maxLength: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** Read and validate the demo form. Unknown select or checkbox values are dropped. */
export function parseLead(formData: FormData): {
  lead: Lead;
  fieldErrors: Partial<Record<LeadField, LeadFieldError>>;
} {
  const role = text(formData, "role", 40);
  const tvCount = text(formData, "tvCount", 20);
  const lead: Lead = {
    name: text(formData, "name", 120),
    barName: text(formData, "barName", 160),
    cityState: text(formData, "cityState", 120),
    role: (roles as readonly string[]).includes(role) ? role : "",
    phone: text(formData, "phone", 40),
    email: text(formData, "email", 200).toLowerCase(),
    sports: formData
      .getAll("sports")
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          (sports as readonly string[]).includes(value),
      ),
    tvCount: (tvOptions as readonly string[]).includes(tvCount) ? tvCount : "",
    notes: text(formData, "notes", 2000),
  };

  const fieldErrors: Partial<Record<LeadField, LeadFieldError>> = {};
  if (!lead.name) fieldErrors.name = "required";
  if (!lead.barName) fieldErrors.barName = "required";
  if (!lead.cityState) fieldErrors.cityState = "required";
  if (!lead.role) fieldErrors.role = "required";
  if (!lead.email) fieldErrors.email = "required";
  else if (!EMAIL_PATTERN.test(lead.email)) fieldErrors.email = "email";
  if (lead.phone && lead.phone.replace(/\D/g, "").length < 10) {
    fieldErrors.phone = "phone";
  }

  return { lead, fieldErrors };
}
