"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Collection } from "@/lib/cloudinary";

interface CollectionsNavProps {
  collections: Collection[];
}

export default function CollectionsNav({ collections }: CollectionsNavProps) {
  const pathname = usePathname();
  const activeSlug = pathname?.startsWith("/collection/")
    ? decodeURIComponent(pathname.replace("/collection/", ""))
    : null;
  const isAllActive = !activeSlug && pathname === "/";

  return (
    <nav className="fixed top-16 left-0 right-0 z-30 bg-background border-b border-white/5">
      <div
        className="px-3 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <Pill href="/" active={isAllActive}>
          All
        </Pill>
        {collections.map((c) => {
          const label = c.name.charAt(0).toUpperCase() + c.name.slice(1);
          return (
            <Pill
              key={c.name}
              href={`/collection/${encodeURIComponent(c.name)}`}
              active={activeSlug === c.name}
            >
              <span>{label}</span>
              <span className={`ml-1.5 text-[10px] ${activeSlug === c.name ? "text-black/50" : "text-white/30"}`}>
                {c.count}
              </span>
            </Pill>
          );
        })}
      </div>
    </nav>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition-colors ${
        active
          ? "bg-white text-black"
          : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
