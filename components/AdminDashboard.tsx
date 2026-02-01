"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Upload, Plus, Check, X, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import type { CloudinaryImage, Collection } from "@/lib/cloudinary";

interface AdminDashboardProps {
  onLogout: () => void;
}

interface PreviewFile {
  file: File;
  preview: string;
  id: string;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "manage" | "collections">("upload");
  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === "manage") {
      fetchImages();
    } else if (activeTab === "collections") {
      fetchCollections();
    }
  }, [activeTab]);

  const fetchImages = async () => {
    try {
      const res = await fetch("/api/images");
      const data = await res.json();
      setImages(data);
    } catch (error) {
      showNotification("error", "Failed to fetch images");
    }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      setCollections(data);
    } catch (error) {
      showNotification("error", "Failed to fetch collections");
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews: PreviewFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  };

  const removePreview = (id: string) => {
    setPreviewFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (previewFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromises = previewFiles.map(async (previewFile) => {
        const formData = new FormData();
        formData.append("file", previewFile.file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        return response.json();
      });

      await Promise.all(uploadPromises);
      
      // Success
      setUploadSuccess(true);
      showNotification("success", `Uploaded ${previewFiles.length} photo${previewFiles.length !== 1 ? "s" : ""}`);
      
      // Clear previews
      previewFiles.forEach((file) => URL.revokeObjectURL(file.preview));
      setPreviewFiles([]);
      
      // Reset success state after delay
      setTimeout(() => setUploadSuccess(false), 2000);
      
    } catch (error) {
      console.error("Upload error:", error);
      showNotification("error", "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const openUploadWidget = () => {
    if (typeof window !== "undefined" && window.cloudinary) {
      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
          folder: "gallery",
          sources: ["local", "camera"],
          multiple: true,
          maxFiles: 50,
          resourceType: "image",
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
          maxFileSize: 20000000,
          styles: {
            palette: {
              window: "#050505",
              windowBorder: "#333",
              tabIcon: "#fff",
              menuIcons: "#fff",
              textDark: "#000",
              textLight: "#fff",
              link: "#fff",
              action: "#339933",
              inactiveTabIcon: "#666",
              error: "#ff4444",
              inProgress: "#339933",
              complete: "#339933",
              sourceBg: "#111",
            },
          },
        },
        (error: any, result: any) => {
          if (!error && result && result.event === "success") {
            setUploadedCount((prev) => prev + 1);
            if (activeTab === "manage") {
              fetchImages();
            }
          }
        }
      );
      widget.open();
    }
  };

  const toggleImageSelection = (publicId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(publicId)) {
      newSelected.delete(publicId);
    } else {
      newSelected.add(publicId);
    }
    setSelectedImages(newSelected);
  };

  const deleteSelectedImages = async () => {
    if (selectedImages.size === 0) return;

    setIsLoading(true);
    try {
      const deletePromises = Array.from(selectedImages).map(async (publicId) => {
        const res = await fetch("/api/images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId }),
        });
        return res.ok;
      });

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(Boolean).length;

      if (successCount === selectedImages.size) {
        showNotification("success", `Deleted ${successCount} images`);
      } else {
        showNotification("error", `Failed to delete ${selectedImages.size - successCount} images`);
      }

      setSelectedImages(new Set());
      fetchImages();
    } catch (error) {
      showNotification("error", "Failed to delete images");
    } finally {
      setIsLoading(false);
    }
  };

  const addToCollection = async () => {
    if (selectedImages.size === 0 || !newCollectionName.trim()) return;

    setIsLoading(true);
    try {
      const collectionName = newCollectionName.trim().toLowerCase();
      const addPromises = Array.from(selectedImages).map(async (publicId) => {
        const res = await fetch("/api/images", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId,
            action: "addToCollection",
            collection: collectionName,
          }),
        });
        return res.ok;
      });

      const results = await Promise.all(addPromises);
      const successCount = results.filter(Boolean).length;

      if (successCount === selectedImages.size) {
        showNotification("success", `Added ${successCount} images to "${collectionName}"`);
        setNewCollectionName("");
        setSelectedImages(new Set());
      } else {
        showNotification("error", `Failed to add ${selectedImages.size - successCount} images`);
      }

      fetchImages();
      fetchCollections();
    } catch (error) {
      showNotification("error", "Failed to add to collection");
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromCollection = async () => {
    if (selectedImages.size === 0) return;

    setIsLoading(true);
    try {
      const removePromises = Array.from(selectedImages).map(async (publicId) => {
        const res = await fetch("/api/images", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId,
            action: "removeFromCollection",
          }),
        });
        return res.ok;
      });

      const results = await Promise.all(removePromises);
      const successCount = results.filter(Boolean).length;

      if (successCount === selectedImages.size) {
        showNotification("success", `Removed ${successCount} images from collections`);
        setSelectedImages(new Set());
      } else {
        showNotification("error", `Failed to remove ${selectedImages.size - successCount} images`);
      }

      fetchImages();
      fetchCollections();
    } catch (error) {
      showNotification("error", "Failed to remove from collection");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Abdul" 
              className="w-8 h-8 rounded-full"
            />
            <h1 className="text-sm font-light tracking-[0.2em] text-white/80">ADMIN</h1>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-white/60 text-xs hover:text-white/80 transition-colors"
            >
              → Gallery
            </a>
            <button
              onClick={onLogout}
              className="text-white/60 text-xs hover:text-white/80 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg text-sm ${
            notification.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      <div className="pt-20">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "upload"
                ? "text-white border-b-2 border-white"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "manage"
                ? "text-white border-b-2 border-white"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Manage Photos
          </button>
          <button
            onClick={() => setActiveTab("collections")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "collections"
                ? "text-white border-b-2 border-white"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Collections
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            {/* Upload Area */}
            <div className="flex-1 p-6 relative">
              {uploadSuccess && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 rounded-2xl">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-white text-sm font-medium">Upload Complete!</p>
                  </div>
                </div>
              )}
              
              {previewFiles.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full max-w-sm mx-auto border-2 border-dashed border-white/20 rounded-2xl p-12 text-center cursor-pointer hover:border-white/40 transition-colors group"
                  >
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/15 transition-colors">
                        <Plus className="w-8 h-8 text-white/60" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm font-medium mb-1">Add Photos</p>
                        <p className="text-white/40 text-xs">Tap to select from your library</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview Grid */}
                  <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto scrollbar-hide">
                    {previewFiles.map((file) => (
                      <div key={file.id} className="relative aspect-square rounded-lg overflow-hidden">
                        <img
                          src={file.preview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removePreview(file.id)}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white/80 hover:bg-black/80 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add More Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 border border-white/20 rounded-xl text-white/60 text-sm hover:border-white/40 hover:text-white/80 transition-colors"
                  >
                    Add More Photos
                  </button>
                </div>
              )}
            </div>

            {/* Fixed Upload Button */}
            <div className="p-4 border-t border-white/10">
              {previewFiles.length > 0 && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full bg-white text-black px-6 py-4 text-sm font-medium rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload {previewFiles.length} Photo{previewFiles.length !== 1 ? "s" : ""}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Manage Tab */}
        {activeTab === "manage" && (
          <div className="p-4">
            {/* Actions Bar */}
            {selectedImages.size > 0 && (
              <div className="mb-4 p-4 bg-white/5 rounded-lg flex items-center gap-4 flex-wrap">
                <span className="text-white/80 text-sm">
                  {selectedImages.size} selected
                </span>
                
                <input
                  type="text"
                  placeholder="New collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm placeholder-white/40"
                />
                
                <button
                  onClick={addToCollection}
                  disabled={isLoading || !newCollectionName.trim()}
                  className="bg-white/20 text-white px-4 py-2 text-sm rounded hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  Add to Collection
                </button>
                
                <button
                  onClick={removeFromCollection}
                  disabled={isLoading}
                  className="bg-white/20 text-white px-4 py-2 text-sm rounded hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  Remove from Collection
                </button>
                
                <button
                  onClick={deleteSelectedImages}
                  disabled={isLoading}
                  className="bg-red-600/80 text-white px-4 py-2 text-sm rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Images Grid */}
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2">
              {images.map((image) => (
                <div
                  key={image.public_id}
                  className={`relative mb-2 break-inside-avoid cursor-pointer group ${
                    selectedImages.has(image.public_id) ? "ring-2 ring-white" : ""
                  }`}
                  onClick={() => toggleImageSelection(image.public_id)}
                >
                  <Image
                    src={image.secure_url}
                    alt=""
                    width={image.width}
                    height={image.height}
                    className="w-full h-auto"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                  
                  {/* Selection Overlay */}
                  {selectedImages.has(image.public_id) && (
                    <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                        <span className="text-black text-xs">✓</span>
                      </div>
                    </div>
                  )}

                  {/* Collection Badge */}
                  {image.context?.collection && (
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-xs">
                      {image.context.collection}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {images.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/40 text-sm">No photos yet</p>
              </div>
            )}
          </div>
        )}

        {/* Collections Tab */}
        {activeTab === "collections" && (
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {collections.map((collection) => (
                <div
                  key={collection.name}
                  className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedCollection(collection.name);
                    setActiveTab("manage");
                  }}
                >
                  {collection.cover_image && (
                    <div className="aspect-video relative">
                      <Image
                        src={collection.cover_image}
                        alt={collection.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-white font-medium">{collection.name}</h3>
                    <p className="text-white/60 text-sm">{collection.count} photos</p>
                  </div>
                </div>
              ))}
            </div>

            {collections.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/40 text-sm">No collections yet</p>
                <p className="text-white/40 text-xs mt-2">
                  Create collections by selecting photos and adding them to a new collection
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
    </main>
  );
}
