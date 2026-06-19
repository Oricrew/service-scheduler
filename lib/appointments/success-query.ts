import {
  assignSuccessValue,
  confirmSuccessValue,
} from "@/lib/appointments/constants";

export function isConfirmSuccess(value: string | undefined) {
  return value === confirmSuccessValue;
}

export function isAssignSuccess(value: string | undefined) {
  return value === assignSuccessValue;
}
