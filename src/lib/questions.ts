export type QuestionType = "text" | "textarea" | "yesno" | "number";

export interface CustomQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: "Short answer",
  textarea: "Long answer",
  yesno: "Yes / No",
  number: "Number",
};

export function parseQuestions(raw: unknown): CustomQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is CustomQuestion => !!q && typeof q === "object" && typeof (q as CustomQuestion).label === "string",
  );
}

/** Base questions every application form contains. */
export const BASE_FIELDS = [
  { id: "city", label: "City of residence", type: "text", required: true },
  { id: "phone", label: "Phone number (10 Digits)", type: "text", required: true },
  { id: "experience", label: "Relevant volunteering experience / skills", type: "textarea", required: true },
  { id: "motivation", label: "Why do you want to volunteer here?", type: "textarea", required: true },
  { id: "availability", label: "Your availability (e.g. Weekends)", type: "text", required: true },
] as const satisfies readonly CustomQuestion[];

export function answersRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, string>;
}
