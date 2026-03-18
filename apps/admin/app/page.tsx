import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_CONFIG } from "@/lib/constants";
import { ROUTES } from "@/lib/routes";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.COOKIE_NAME);

  if (token) {
    redirect(ROUTES.DASHBOARD);
  } else {
    redirect(ROUTES.LOGIN);
  }
}
