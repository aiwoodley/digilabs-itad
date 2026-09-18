// Fire-and-log confirmation email via the shared DigiLabs Supabase project's
// send-email edge function. Never blocks or fails the caller — if the
// request errors, we just log it quietly so the Supabase write still counts
// as success. Same mechanism as the Education site's src/lib/notify.ts.
export async function sendEmail(type: string, to: string | null | undefined, data: unknown) {
  if (!to) return;

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ type, to, data }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("Confirmation email not sent:", res.status, body);
    }
  } catch (err) {
    console.warn("Confirmation email request failed:", err);
  }
}
