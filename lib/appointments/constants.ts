export const confirmSuccessParam = "confirmed";
export const confirmSuccessValue = "true";

export function isConfirmSuccess(value: string | undefined) {
  return value === confirmSuccessValue;
}
