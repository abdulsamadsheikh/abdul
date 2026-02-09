import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { findDuplicates, deleteImage } from "@/lib/cloudinary";

// GET: Find all duplicate images
export async function GET() {
  try {
    const duplicates = await findDuplicates("gallery");
    return NextResponse.json({ duplicates, count: duplicates.length });
  } catch (error) {
    console.error("Error finding duplicates:", error);
    return NextResponse.json({ error: "Failed to find duplicates" }, { status: 500 });
  }
}

// DELETE: Remove all duplicate images (keeps the first/newest of each group)
export async function DELETE() {
  try {
    const duplicates = await findDuplicates("gallery");

    if (duplicates.length === 0) {
      return NextResponse.json({ message: "No duplicates found", deleted: 0 });
    }

    let deletedCount = 0;
    for (const group of duplicates) {
      // Keep the first one (newest), delete the rest
      const toDelete = group.public_ids.slice(1);
      for (const publicId of toDelete) {
        const success = await deleteImage(publicId);
        if (success) deletedCount++;
      }
    }

    revalidateTag("cloudinary-images", "max");

    return NextResponse.json({
      message: `Deleted ${deletedCount} duplicate images`,
      deleted: deletedCount,
      groups: duplicates.length,
    });
  } catch (error) {
    console.error("Error deleting duplicates:", error);
    return NextResponse.json({ error: "Failed to delete duplicates" }, { status: 500 });
  }
}
