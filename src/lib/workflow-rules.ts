export type OpportunityInput = {
  title: string; description: string; slots: number; hours_estimate: number;
  min_age: number; starts_at: string; ends_at: string; application_deadline: string;
  is_paid: boolean; stipend: string;
};

export function validateOpportunity(input: OpportunityInput): string | null {
  if (!input.title.trim() || !input.description.trim()) return "Title and description are required";
  if (!Number.isInteger(input.slots) || input.slots < 1) return "Enter a positive whole number of slots";
  if (!Number.isInteger(input.hours_estimate) || input.hours_estimate < 0) return "Estimated hours must be a non-negative whole number";
  if (!Number.isInteger(input.min_age) || input.min_age < 0) return "Minimum age must be a non-negative whole number";
  if (input.starts_at && input.ends_at && new Date(input.ends_at) < new Date(input.starts_at)) return "End must follow start";
  if (input.is_paid && !input.stipend.trim()) return "Please enter the stipend / pay details";
  return null;
}

export function applicationBlockReason(status: string, deadline: string | null, remaining: number | undefined, now = Date.now()): string | null {
  if (status !== "published") return "This opportunity is not accepting applications.";
  if (deadline && new Date(deadline).getTime() <= now) return "The application deadline has passed.";
  if (remaining !== undefined && remaining <= 0) return "No slots are available.";
  return null;
}

export function dateFilterBounds(from: string, to: string) {
  return {
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  };
}