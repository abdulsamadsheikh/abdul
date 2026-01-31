import Gallery from "@/components/Gallery";
import { getImagesByCollection, getCollections } from "@/lib/cloudinary";
import { notFound } from "next/navigation";
import Link from "next/link";

interface CollectionPageProps {
  params: {
    slug: string;
  };
}

export const revalidate = 60;

export default async function CollectionPage({ params }: CollectionPageProps) {
  const collectionName = decodeURIComponent(params.slug);
  const [images, collections] = await Promise.all([
    getImagesByCollection(collectionName),
    getCollections(),
  ]);

  const collection = collections.find(c => c.name === collectionName);

  if (!collection && images.length === 0) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-sm font-light tracking-[0.2em] text-white/80 uppercase">
              {collectionName}
            </h1>
          </div>
          {collection && (
            <span className="text-white/40 text-sm">
              {collection.count} photos
            </span>
          )}
        </div>
      </header>
      
      <div className="pt-20 pb-8 px-1 sm:px-2">
        {images.length > 0 ? (
          <Gallery images={images} />
        ) : (
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-white/40 text-sm tracking-wide">
              No photos in this collection yet
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
