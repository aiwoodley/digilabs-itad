// Public Supabase config. Both values are meant to be public (they ship to every
// browser); data is protected by row-level security, not by hiding these.
// Hardcoded fallbacks exist because the Netlify site's build doesn't inject
// NEXT_PUBLIC_* vars, which left the client-side admin unable to connect.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sqxdlaeoeawhimvwkoln.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxeGRsYWVvZWF3aGltdndrb2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTU5MDMsImV4cCI6MjA5MjU5MTkwM30.DxGg5JhGftZQmuupxRUEtZYDOE4vAj50Va8Wn0Wymiw";
