import type { ReactNode } from "react";

function Wrapper({
  children,
  fullWidth = false,
  immersive = false,
}: {
  children: ReactNode;
  fullWidth?: boolean;
  immersive?: boolean;
}) {
  return (
    <div
      className={`${fullWidth ? "w-full" : "container"} ${immersive ? "flex h-full flex-col p-0" : "mx-auto p-6"} min-w-0 flex-1`}
    >
      {children}
    </div>
  );
}

export { Wrapper };
