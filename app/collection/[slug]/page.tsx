import Gallery from "@/components/Gallery";
import { getImagesByCollection, getCollections } from "@/lib/cloudinary";
import { notFound } from "next/navigation";
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

  const collection = collections.find(c => c.name === collectionName);

  // A collection is valid if it has images, regardless of whether it's in the collections list
  const isValidCollection = images.length > 0;
  
  // Fun messages for invalid collections
  const getFunMessage = () => {
    const messages = [
      "You're early! This collection hasn't been created yet.",
      "Oops! You found a collection that doesn't exist... yet.",
      "This collection is still loading into the future.",
      "You've discovered a phantom collection! Spooky.",
      "This collection is on vacation. Try again later.",
      "404: Collection not found, but your adventure continues!",
      "This collection is playing hide and seek. You found it!",
      "Early bird gets the... empty collection?",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

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
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Abdul" 
                className="w-8 h-8 rounded-full"
              />
              <h1 className="text-sm font-light tracking-[0.2em] text-white/80">
                {collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}
              </h1>
            </div>
          </div>
          <span className="text-white/40 text-sm">
            {collection ? `${collection.count} photos` : `${images.length} photos`}
          </span>
        </div>
      </header>
      
      <div className="pt-20 pb-8 px-1 sm:px-2">
        {images.length > 0 ? (
          <Gallery images={images} />
        ) : (
          <div className="flex items-center justify-center min-h-[50vh] px-4">
            <div className="text-center max-w-md">
              <h2 className="text-white/60 text-lg font-light mb-4">
                {collectionName.charAt(0).toUpperCase() + collectionName.slice(1)}
              </h2>
              <p className="text-white/40 text-sm tracking-wide mb-6">
                {getFunMessage()}
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
