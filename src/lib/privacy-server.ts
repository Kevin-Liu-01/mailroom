import { cookies } from "next/headers";
import { HIDE_EMAILS_COOKIE } from "./privacy";

/** Whether this browser asked the app to hide email addresses. */
export async function emailsHidden(): Promise<boolean> {
  return (await cookies()).get(HIDE_EMAILS_COOKIE)?.value === "1";
}
