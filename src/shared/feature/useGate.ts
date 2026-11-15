import { useSession } from '../auth/session';
import type { Gate } from './registry';

export function useGate(): Gate {
  const permissions = useSession((s) => s.permissions);
  const flags = useSession((s) => s.branchFlags ?? s.flags);
  return {
    can: (k) => (k ? permissions.has(k) : true),
    flag: (k) => (k ? flags[k] === true : true),
  };
}
