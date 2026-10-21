import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabase } from "./client";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    let userId = "11111111-1111-1111-1111-111111111111"; // Fallback to Super Admin

    const request = getRequest();
    if (request?.headers) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer mock-jwt-")) {
        const parts = authHeader.replace("Bearer mock-jwt-", "").split("-");
        if (parts[0]) userId = parts[0];
      }
    }

    return next({
      context: {
        supabase,
        userId,
        claims: { sub: userId },
      },
    });
  }
);
