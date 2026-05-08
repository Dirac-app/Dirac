import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface InviteCode {
  id: number;
  code_hash: string;
  tester_name: string;
  used?: boolean;
  used_at?: string | null;
  github_username?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface InviteCodePublic {
  id: number;
  testerName: string;
  used: boolean;
  usedAt: string | null;
  githubUsername: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Schema init — creates table if it doesn't exist
// ---------------------------------------------------------------------------
let _initialized = false;

export async function initDb(): Promise<void> {
  if (_initialized) return;
  const supabase = getSupabaseClient();
  // Try to query the table — if it fails with "relation does not exist", create it via RPC
  // Note: Supabase doesn't support raw DDL via JS client without RPC.
  // The table should be created via Supabase dashboard SQL editor:
  // CREATE TABLE IF NOT EXISTS invite_codes (
  //   id            SERIAL PRIMARY KEY,
  //   code_hash     TEXT        NOT NULL UNIQUE,
  //   tester_name   TEXT        NOT NULL,
  //   used          BOOLEAN     NOT NULL DEFAULT FALSE,
  //   used_at       TIMESTAMPTZ,
  //   github_username TEXT,
  //   email         TEXT,
  //   notes         TEXT,
  //   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  // );
  const { error } = await supabase.from('invite_codes').select('id').limit(1);
  if (error && error.code === '42P01') {
    throw new Error('invite_codes table does not exist. Please create it in Supabase dashboard.');
  }
  _initialized = true;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function getAllCodes(): Promise<InviteCodePublic[]> {
  await initDb();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, tester_name, used, used_at, github_username, email, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    testerName: r.tester_name,
    used: r.used,
    usedAt: r.used_at,
    githubUsername: r.github_username,
    email: r.email,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export async function getUnusedCodesWithHashes(): Promise<InviteCode[]> {
  await initDb();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, code_hash, tester_name')
    .eq('used', false);

  if (error) throw error;
  return data ?? [];
}

export async function insertCode(
  codeHash: string,
  testerName: string,
  email?: string,
  notes?: string,
): Promise<number> {
  await initDb();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      code_hash: codeHash,
      tester_name: testerName,
      email: email ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function markCodeUsed(id: number, githubUsername: string): Promise<void> {
  await initDb();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('invite_codes')
    .update({ used: true, used_at: new Date().toISOString(), github_username: githubUsername })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCode(id: number): Promise<void> {
  await initDb();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('invite_codes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getCodeById(id: number): Promise<InviteCode | null> {
  await initDb();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data ?? null;
}
