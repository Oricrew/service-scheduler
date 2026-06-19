import { pendingRequestStatuses } from "@/lib/requests/types";

import { assignableStatuses } from "./types";

export function canConfirmStatus(status: string) {
  return (pendingRequestStatuses as readonly string[]).includes(status);
}

export function canAssignStatus(status: string) {
  return (assignableStatuses as readonly string[]).includes(status);
}
