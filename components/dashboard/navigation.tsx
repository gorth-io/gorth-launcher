import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";
interface DashboardNavigation {
  pathname: string;
  onNavigate: (url: string) => void;
}
const NavigationContext = createContext<DashboardNavigation | null>(null);
export function DashboardNavigationProvider({
  children,
  ...navigation
}: DashboardNavigation & { children: ReactNode }) {
  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  );
}
export function useDashboardNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation)
    throw new Error(
      "Dashboard navigation requires DashboardNavigationProvider",
    );
  return navigation;
}
export function usePathname() {
  return useDashboardNavigation().pathname;
}
export function DashboardLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  const { onNavigate } = useDashboardNavigation();
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        onNavigate(href);
      }}
    />
  );
}
