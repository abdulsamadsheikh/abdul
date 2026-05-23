import { notFound } from "next/navigation";
import { getImageByPhotoId, getAdjacentPhotos, getFullPublicId } from "@/lib/cloudinary";
import PhotoViewer from "@/components/PhotoViewer";
import { v2 as cloudinary } from "cloudinary";
import cloudinaryLoader from "@/lib/cloudinary-loader";

interface PhotoPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    collection?: string;
  }>;
}

export const revalidate = 60;

// Prefetch URL must match what the custom loader will request for <Image>,
// otherwise the preload is wasted (different URL → different cache entry).
function getPrefetchUrl(photoId: string | null): string | undefined {
  if (!photoId) return undefined;
  const baseUrl = cloudinary.url(getFullPublicId(photoId), { secure: true });
  return cloudinaryLoader({ src: baseUrl, width: 1920, quality: 75 });
}

export default async function PhotoPage({ params, searchParams }: PhotoPageProps) {
  const { id } = await params;
  const { collection } = await searchParams;
  const photoId = decodeURIComponent(id);

  const [image, navigation] = await Promise.all([
    getImageByPhotoId(photoId),
    getAdjacentPhotos(photoId, collection),
  ]);

  if (!image) {
    notFound();
  }

  return (
    <PhotoViewer
      image={image}
      prevId={navigation.prev}
      nextId={navigation.next}
      prevImageUrl={getPrefetchUrl(navigation.prev)}
      nextImageUrl={getPrefetchUrl(navigation.next)}
      currentIndex={navigation.currentIndex}
      total={navigation.total}
      collection={collection}
    />
  );
}
