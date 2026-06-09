// A fresh nonce generated once per active runtime/tab instance — deliberately
// NOT persisted or shared device-wide. A device-wide ID would let sibling
// tabs/contexts suppress each other's genuine remote-change notices (each tab
// would mistake the other's writes for its own). See PLAN-IOS-PWA.md Risks.
function generateRuntimeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const RUNTIME_ID = generateRuntimeId();
