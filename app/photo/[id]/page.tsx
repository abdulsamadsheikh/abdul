import { notFound } from "next/navigation";
import { getImageByPhotoId, getAdjacentPhotos, getFullPublicId } from "@/lib/cloudinary";
import PhotoViewer from "@/components/PhotoViewer";
import { v2 as cloudinary } from "cloudinary";

interface PhotoPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    collection?: string;
  }>;
}

export const revalidate = 60;

// Generate optimized URL for prefetching
function getPrefetchUrl(photoId: string | null): string | undefined {
  if (!photoId) return undefined;
  
  const fullPublicId = getFullPublicId(photoId);
  return cloudinary.url(fullPublicId, {
    transformation: [
      { width: 1920, crop: "limit" },
      { quality: "auto:best", fetch_format: "auto" },
      { angle: "auto" }
    ]
  });
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
