import Gallery from "@/components/Gallery";
import { getImages, getCollections } from "@/lib/cloudinary";
import CollectionsNav from "@/components/CollectionsNav";

export const revalidate = 60;

export default async function Home() {
  const [images, collections] = await Promise.all([
    getImages("gallery"),
    getCollections(),
  ]);

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-6 flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Abdul" 
            className="w-8 h-8 rounded-full"
          />
          <h1 className="text-sm font-light tracking-[0.2em] text-white/80">
            ABDUL
          </h1>
        </div>
      </header>
      
      <CollectionsNav collections={collections} />
      
      <div className="pt-32 pb-8 px-1 sm:px-2">
        <Gallery images={images} />
      </div>
    </main>
  );
}
