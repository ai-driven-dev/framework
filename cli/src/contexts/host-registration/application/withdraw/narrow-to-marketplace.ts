import { isRefOnHost } from "../../domain/record/host-ref.js";
import { recordedRegistrations } from "../../domain/record/registration-record.js";
import type { ProjectRegistrationWithdrawal } from "./withdrawal.js";

/** The withdrawals reduced to one marketplace by its alias: each tool's record keeps that
 * marketplace and the refs on its host name, and a tool that never registered it drops out. With
 * no alias, every withdrawal stays whole. */
export function narrowToMarketplace(
  withdrawals: readonly ProjectRegistrationWithdrawal[],
  alias: string | undefined
): readonly ProjectRegistrationWithdrawal[] {
  if (alias === undefined) return withdrawals;
  return withdrawals.flatMap((withdrawal) => {
    const { marketplaces, pluginRefs } = recordedRegistrations(withdrawal.registrations);
    const kept = marketplaces.filter((registration) => registration.alias === alias);
    if (kept.length === 0) return [];
    const refs = pluginRefs.filter((ref) => kept.some((m) => isRefOnHost(ref, m.hostName)));
    return [
      {
        ...withdrawal,
        registrations: { ...withdrawal.registrations, marketplaces: kept, pluginRefs: refs },
      },
    ];
  });
}
