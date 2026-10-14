import { createContext } from 'react';

export type RealtimeConnectionStatus = 'disabled' | 'connecting' | 'connected' | 'error';

export const RealtimeContext = createContext<{
  revision: number;
  status: RealtimeConnectionStatus;
}>({ revision: 0, status: 'disabled' });
