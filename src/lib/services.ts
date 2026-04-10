import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ✅ Shared Redis instance
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const resend = new Resend(process.env.RESEND_API_KEY);

// 🔁 Default limit: 5 reqs / 1 min
export const defaultRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "global",
});

// 🧠 Extract IP
export function getIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// 🚨 Stripe-safe default limiter
export async function secureRatelimit(req: Request) {
  const ip = getIP(req);
  return await defaultRateLimit.limit(ip);
}
