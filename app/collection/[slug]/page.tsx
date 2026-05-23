import Gallery from "@/components/Gallery";
import CollectionsNav from "@/components/CollectionsNav";
import { getImagesByCollection, getCollections } from "@/lib/cloudinary";
import Link from "next/link";

interface CollectionPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const revalidate = 60;

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collectionName = decodeURIComponent(slug);
  const [images, collections] = await Promise.all([
    getImagesByCollection(collectionName),
    getCollections(),
  ]);

  const collection = collections.find((c) => c.name === collectionName);
  const title = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 bg-background">
        <div className="px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 group"
          >
            <img
              src="/logo.png"
              alt="Abdul"
              className="w-8 h-8 rounded-full"
            />
            <h1 className="text-sm font-light tracking-[0.2em] text-white/80 group-hover:text-white transition-colors">
              {title.toUpperCase()}
            </h1>
          </Link>
          <span className="text-white/40 text-xs tabular-nums">
            {collection ? collection.count : images.length} photos
          </span>
        </div>
      </header>

      <CollectionsNav collections={collections} />

      <div className="pt-32 pb-8 px-1 sm:px-2">
        {images.length > 0 ? (
          <Gallery images={images} collection={collectionName} />
        ) : (
          <div className="flex items-center justify-center min-h-[50vh] px-4">
            <div className="text-center max-w-md">
              <p className="text-white/40 text-sm tracking-wide mb-6">
                No photos in this collection yet.
              </p>
              <Link
                href="/"
                className="inline-block text-white/60 hover:text-white text-sm transition-colors"
              >
                ← Back to Gallery
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
