export function getPhotoId(publicId: string): string {
  // Extract the filename without folder prefix (e.g., "gallery/abc123" -> "abc123")
  const parts = publicId.split("/");
  return parts[parts.length - 1];
}

export function getFullPublicId(photoId: string, folder: string = "gallery"): string {
  return `${folder}/${photoId}`;
}
