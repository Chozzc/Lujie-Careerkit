import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookieName } from "@/i18n/config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get(localeCookieName)?.value;
  const activeLocale = isLocale(locale) ? locale : defaultLocale;

  return {
    locale: activeLocale,
    messages: (await import(`../../messages/${activeLocale}.json`)).default,
  };
});
