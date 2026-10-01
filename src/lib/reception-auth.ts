import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
export const RECEPTION_COOKIE = "staff_session";
export type StaffUser = { id: string; username: string; name: string; session_version: number; password_reset_pending?: boolean };
export function sessionHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export async function readStaffUser(): Promise<StaffUser | null> {
 const token = (await cookies()).get(RECEPTION_COOKIE)?.value;
 if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 const db = getAdminClient();
 if (!db) return null;
 const { data: session, error } = await db.from("staff_sessions").select("user_id,session_version,expires_at").eq("token_hash",sessionHash(token)).maybeSingle();
 if (error || !session || Date.parse(session.expires_at) <= Date.now()) return null;
 const { data: user } = await db.from("staff_users").select("id,username,name,session_version,password_reset_pending").eq("id",session.user_id).maybeSingle();
 if (!user || user.password_reset_pending || user.session_version !== session.session_version) return null;
 return user as StaffUser;
}
export async function readReceptionAuthed(): Promise<boolean> { return Boolean(await readStaffUser()); }
export async function createStaffSession(user: StaffUser): Promise<boolean> {
 const db = getAdminClient();
 if (!db) return false;
 const token = randomBytes(32).toString("hex");
 const expiresAt = new Date(Date.now()+12*60*60*1000);
 const { error } = await db.from("staff_sessions").insert({ token_hash: sessionHash(token), user_id: user.id, session_version: user.session_version, expires_at: expiresAt.toISOString() });
 if(error) return false;
 const jar = await cookies();
 jar.set(RECEPTION_COOKIE,token,{ httpOnly:true, secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:12*60*60,path:"/" });
 jar.delete("reception_auth");
 return true;
}
export async function deleteStaffSession(): Promise<void> {
 const jar = await cookies(), token = jar.get(RECEPTION_COOKIE)?.value, db = getAdminClient();
 if(token && db) await db.from("staff_sessions").delete().eq("token_hash",sessionHash(token));
 jar.delete(RECEPTION_COOKIE); jar.delete("reception_auth");
}
