import { useContext } from 'react';
import { RealtimeContext } from './realtime-context';

export function useRealtimeRevision(): number {
  return useContext(RealtimeContext).revision;
}

export function useRealtimeConnectionStatus() {
  return useContext(RealtimeContext).status;
}
