import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getImages, getImagesByCollection, deleteImage, addImageToCollection, removeFromCollection } from "@/lib/cloudinary";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get("collection");
    
    if (collection) {
      const images = await getImagesByCollection(collection);
      return NextResponse.json(images);
    } else {
      const images = await getImages();
      return NextResponse.json(images);
    }
  } catch (error) {
    console.error("Error fetching images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { publicId } = await request.json();
    
    if (!publicId) {
      return NextResponse.json({ error: "Public ID is required" }, { status: 400 });
    }

    const success = await deleteImage(publicId);
    
    if (success) {
      revalidateTag("cloudinary-images", "max");
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { publicId, action, collection } = await request.json();
    
    if (!publicId) {
      return NextResponse.json({ error: "Public ID is required" }, { status: 400 });
    }

    let success = false;

    if (action === "addToCollection" && collection) {
      success = await addImageToCollection(publicId, collection);
    } else if (action === "removeFromCollection") {
      success = await removeFromCollection(publicId);
    }

    if (success) {
      revalidateTag("cloudinary-images", "max");
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error updating image:", error);
    return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
  }
}
