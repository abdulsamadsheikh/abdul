import Gallery from "@/components/Gallery";
import { getImages } from "@/lib/cloudinary";

export const revalidate = 60;

export default async function Home() {
  const images = await getImages("gallery");

  return (
    <main className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-6">
          <h1 className="text-sm font-light tracking-[0.2em] text-white/80">
            ABDUL
          </h1>
        </div>
      </header>
      
      <div className="pt-20 pb-8 px-1 sm:px-2">
        <Gallery images={images} />
      </div>
    </main>
  );
}
