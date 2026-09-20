import { ModulePlaceholder } from '../components/modules/ModulePlaceholder';
import type { NavigationItem } from '../data/navigation';

type ModulePageProps = {
  route: NavigationItem;
};

// ModulePage is a route adapter, not a domain implementation.
export function ModulePage({ route }: ModulePageProps) {
  return <ModulePlaceholder route={route} />;
}
