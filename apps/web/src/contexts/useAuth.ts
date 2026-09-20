import { useContext } from 'react';
import { AuthContext } from './auth-context';

// useAuth keeps consumers independent from the provider implementation details.
export function useAuth() {
  return useContext(AuthContext);
}
