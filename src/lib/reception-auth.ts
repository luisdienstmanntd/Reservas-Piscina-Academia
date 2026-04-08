import { cookies } from "next/headers";

export const RECEPTION_COOKIE = "reception_auth";
export const RECEPTION_COOKIE_VALUE = "1";

export async function readReceptionAuthed(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(RECEPTION_COOKIE)?.value === RECEPTION_COOKIE_VALUE;
}
