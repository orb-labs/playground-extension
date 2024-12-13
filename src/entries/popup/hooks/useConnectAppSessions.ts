import { useBulkConnectAppSessions } from '@orb-labs/orby-react';
import * as React from 'react';

import { useAppSessionsStore } from '~/core/state';

export function useConnectAppSessions() {
  const { appSessions } = useAppSessionsStore();

  const activeSessions = React.useMemo(() => {
    return Array.from(Object.keys(appSessions)).map((host) => {
      return { host, address: appSessions[host].activeSessionAddress };
    });
  }, [appSessions]);

  const { isLoading, isConnected } = useBulkConnectAppSessions(activeSessions);
  return { isLoading, isConnected };
}
