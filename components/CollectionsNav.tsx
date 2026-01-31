"use client";

import Link from "next/link";
import type { Collection } from "@/lib/cloudinary";

interface CollectionsNavProps {
  collections: Collection[];
}

export default function CollectionsNav({ collections }: CollectionsNavProps) {
  return (
    <nav className="fixed top-16 left-0 right-0 z-30 bg-background/90 backdrop-blur-md border-b border-white/10">
      <div className="px-4 py-3">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
          <Link
            href="/"
            className="flex-shrink-0 text-white/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            All Photos
          </Link>
          
          {collections.map((collection) => (
            <Link
              key={collection.name}
              href={`/collection/${encodeURIComponent(collection.name)}`}
              className="flex-shrink-0 text-white/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              {collection.name.charAt(0).toUpperCase() + collection.name.slice(1)} ({collection.count})
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
