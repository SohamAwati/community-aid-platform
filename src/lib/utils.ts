import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  // Standard phone numbers must have between 10 and 15 digits
  if (digits.length < 10 || digits.length > 15) return false;
  // Reject dummy repeating numbers like 0000000000 or 1111111111
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

