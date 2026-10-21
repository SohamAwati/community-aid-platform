export type OpportunityInput = {
  title: string; description: string; slots: number; hours_estimate: number;
  min_age: number; starts_at: string; ends_at: string; application_deadline: string;
  is_paid: boolean; stipend: string;
};

export function validateOpportunity(input: OpportunityInput, isEdit = false, now = Date.now()): string | null {
  if (!input.title.trim() || !input.description.trim()) return "Title and description are required";
  if (!Number.isInteger(input.slots) || input.slots < 1) return "Enter a positive whole number of slots";
  if (!Number.isInteger(input.hours_estimate) || input.hours_estimate < 0) return "Estimated hours must be a non-negative whole number";
  if (!Number.isInteger(input.min_age) || input.min_age < 0) return "Minimum age must be a non-negative whole number";

  // Date restrictions
  const graceNow = now - 60000; // 1 minute grace period for form completion
  if (!isEdit && input.starts_at && new Date(input.starts_at).getTime() < graceNow) {
    return "Start date and time cannot be in the past";
  }
  if (input.ends_at && new Date(input.ends_at).getTime() < graceNow) {
    return "End date and time cannot be in the past";
  }
  if (input.starts_at && input.ends_at && new Date(input.ends_at).getTime() <= new Date(input.starts_at).getTime()) {
    return "End date and time must be after the start date and time";
  }
  if (!isEdit && input.application_deadline) {
    const deadlineTime = new Date(`${input.application_deadline}T23:59:59.999`).getTime();
    if (deadlineTime < graceNow) {
      return "Application deadline cannot be in the past";
    }
    if (input.starts_at && deadlineTime > new Date(input.starts_at).getTime()) {
      return "Application deadline cannot be after the opportunity starts";
    }
  }

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