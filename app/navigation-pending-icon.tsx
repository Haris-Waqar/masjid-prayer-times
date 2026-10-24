"use client";

import { useLinkStatus } from "next/link";
import { ArrowLeft, LoaderCircle, Settings2 } from "lucide-react";

type Props = {
  kind: "back" | "admin";
  size: number;
};

export function NavigationPendingIcon({ kind, size }: Props) {
  const { pending } = useLinkStatus();
  const Icon = pending ? LoaderCircle : kind === "back" ? ArrowLeft : Settings2;

  return (
    <span
      className="navigation-icon"
      data-navigation-pending={pending}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon className={pending ? "is-spinning" : undefined} size={size} />
    </span>
  );
}
