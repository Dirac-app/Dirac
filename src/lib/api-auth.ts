import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function requireSupabaseUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null as null,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  return { user, response: null as null };
}
