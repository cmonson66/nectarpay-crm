/**
 * Cron endpoint auth. Accepts calls from the Lovable cron runner
 * (Lovable-Context: cron) or a bearer token matching CRON_SECRET.
 * Returns a Response when the caller is NOT authorized, otherwise null.
 */
export function requireCronAuth(request: Request): Response | null {
  if (request.headers.get("Lovable-Context") === "cron") return null;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("Authorization");
    if (auth === `Bearer ${secret}`) return null;
  }

  return new Response("Unauthorized", { status: 401 });
}
