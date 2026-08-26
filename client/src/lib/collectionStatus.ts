export const ACCESS_RESTRICTION_FRAGMENT = "refused automated access from the DBTI server";
export const ACCESS_RESTRICTION_MESSAGE = "The website refused automated access from the DBTI server during this scan (HTTP 403). It may still work normally in a personal browser.";

export function isAccessRestrictionMessage(message: string) {
  return message.toLowerCase().includes(ACCESS_RESTRICTION_FRAGMENT.toLowerCase());
}
