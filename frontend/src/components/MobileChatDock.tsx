import type { ReactNode } from "react";

interface MobileChatDockProps {
  children: ReactNode;
}

/** Dock mobile dans le flux flex — le viewport entier suit le visual viewport iOS. */
export function MobileChatDock({ children }: MobileChatDockProps) {
  return <div className="chat-dock safe-x">{children}</div>;
}
