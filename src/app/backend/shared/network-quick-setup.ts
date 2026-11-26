// Keep persisted step IDs stable for environments already in setup.
export const ACCOUNTING_SETUP_STEP = 6;
export const NETWORK_SETUP_STEPS = [1, ACCOUNTING_SETUP_STEP, 2, 3, 4] as const;
export const NETWORK_SETUP_COMPLETE = 5;
export type NetworkSetupStep = typeof NETWORK_SETUP_STEPS[number];

export function isNetworkSetupStep(value:unknown):value is NetworkSetupStep{
 return NETWORK_SETUP_STEPS.some(step=>step===value);
}
