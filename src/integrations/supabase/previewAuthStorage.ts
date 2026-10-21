// Standard local storage broker for auth session persistence
export function brokeredPreviewStorage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
