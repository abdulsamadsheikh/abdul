"use client";

import Link from "next/link";
import Image from "next/image";
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
              className="flex-shrink-0 flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap group"
            >
              {collection.cover_image && (
                <div className="relative w-6 h-6 rounded overflow-hidden">
                  <Image
                    src={collection.cover_image}
                    alt={collection.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
              )}
              <span>{collection.name}</span>
              <span className="text-white/40 text-xs">({collection.count})</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
