"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<{ name: string; reason: string }[]>([]);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  useEffect(() => {
    if (activeTab === "manage") {
      fetchImages();
    } else if (activeTab === "collections") {
      fetchCollections();
    }
  }, [activeTab]);

  const filteredImages = useMemo(
    () =>
      selectedCollection
        ? images.filter((img) => img.context?.collection === selectedCollection)
        : images,
    [images, selectedCollection]
  );

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
    const rejected: string[] = [];
    const accepted: PreviewFile[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
        continue;
      }
      if (file.size === 0) {
        rejected.push(`${file.name} (empty)`);
        continue;
      }
      accepted.push({
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).slice(2, 11),
      });
    }

    if (rejected.length) {
      showNotification(
        "error",
        `Skipped ${rejected.length} file${rejected.length !== 1 ? "s" : ""}: ${rejected.slice(0, 2).join(", ")}${rejected.length > 2 ? "…" : ""}`
      );
    }
    setPreviewFiles((prev) => [...prev, ...accepted]);
    // Reset input so the same file can be reselected
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    setDuplicateCount(0);
    setFailedCount(0);
    setUploadErrors([]);

    let uploaded = 0;
    let duplicates = 0;
    let failed = 0;
    const errors: { name: string; reason: string }[] = [];
    // Hold a snapshot — state may change during async work
    const filesToUpload = previewFiles;

    for (const previewFile of filesToUpload) {
      const formData = new FormData();
      formData.append("file", previewFile.file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (response.ok) {
          uploaded++;
        } else if (response.status === 409) {
          duplicates++;
        } else {
          failed++;
          errors.push({
            name: previewFile.file.name,
            reason: payload?.message || `HTTP ${response.status}`,
          });
        }
      } catch (err: any) {
        failed++;
        errors.push({
          name: previewFile.file.name,
          reason: err?.message || "Network error",
        });
      }

      setUploadProgress(
        Math.round(((uploaded + duplicates + failed) / filesToUpload.length) * 100)
      );
    }

    setDuplicateCount(duplicates);
    setFailedCount(failed);
    setUploadErrors(errors);
    setUploadSuccess(true);

    // Build summary message
    const parts: string[] = [];
    if (uploaded) parts.push(`Uploaded ${uploaded}`);
    if (duplicates) parts.push(`skipped ${duplicates} duplicate${duplicates !== 1 ? "s" : ""}`);
    if (failed) parts.push(`${failed} failed`);
    const summary = parts.join(", ") || "Nothing uploaded";
    showNotification(failed > 0 || (uploaded === 0 && duplicates === 0) ? "error" : "success", summary);

    // Clear previews
    filesToUpload.forEach((file) => URL.revokeObjectURL(file.preview));
    setPreviewFiles([]);

    setIsUploading(false);
    setUploadProgress(0);

    // Hide success overlay after a moment, but keep error details visible
    setTimeout(() => {
      setUploadSuccess(false);
      setDuplicateCount(0);
      // Keep errors visible until user dismisses
    }, failed > 0 ? 6000 : 2500);
  };

  const cleanDuplicates = async () => {
    setIsCleaningDuplicates(true);
    try {
      // First scan for duplicates
      const scanRes = await fetch("/api/duplicates");
      const scanData = await scanRes.json();

      if (scanData.count === 0) {
        showNotification("success", "No duplicates found");
        return;
      }

      // Delete duplicates
      const deleteRes = await fetch("/api/duplicates", { method: "DELETE" });
      const deleteData = await deleteRes.json();

      showNotification("success", deleteData.message);
      fetchImages();
    } catch (error) {
      showNotification("error", "Failed to clean duplicates");
    } finally {
      setIsCleaningDuplicates(false);
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
      <header className="fixed top-0 left-0 right-0 z-40 bg-background border-b border-white/10">
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
                <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-10 rounded-2xl p-6">
                  <div className="text-center max-w-sm w-full">
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        failedCount > 0
                          ? "bg-red-500"
                          : duplicateCount > 0
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                    >
                      {failedCount > 0 ? (
                        <X className="w-10 h-10 text-white" />
                      ) : (
                        <Check className="w-10 h-10 text-white" />
                      )}
                    </div>
                    <p className="text-white text-sm font-medium mb-1">
                      {failedCount > 0
                        ? `${failedCount} upload${failedCount !== 1 ? "s" : ""} failed`
                        : duplicateCount > 0
                        ? `Skipped ${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""}`
                        : "Upload Complete!"}
                    </p>
                    {uploadErrors.length > 0 && (
                      <div className="mt-4 text-left bg-black/40 rounded-lg p-3 max-h-48 overflow-y-auto scrollbar-hide">
                        {uploadErrors.map((e, i) => (
                          <div key={i} className="text-[11px] mb-1">
                            <span className="text-white/80">{e.name}</span>
                            <span className="text-red-400 ml-1">— {e.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setUploadSuccess(false);
                        setUploadErrors([]);
                        setFailedCount(0);
                        setDuplicateCount(0);
                      }}
                      className="mt-4 text-white/60 text-xs hover:text-white/80"
                    >
                      Dismiss
                    </button>
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
                      <span>Uploading{uploadProgress > 0 ? ` ${uploadProgress}%` : '...'}</span>
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
          <div className="p-4 pb-32">
            {/* Filter + Tools */}
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="tabular-nums">
                  {filteredImages.length} of {images.length} photos
                </span>
                {selectedCollection && (
                  <button
                    onClick={() => setSelectedCollection("")}
                    className="ml-2 px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-full text-white/70 inline-flex items-center gap-1"
                  >
                    {selectedCollection}
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedImages(new Set(filteredImages.map(i => i.public_id)))}
                  className="text-white/50 text-xs hover:text-white/80 transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={cleanDuplicates}
                  disabled={isCleaningDuplicates}
                  className="text-white/50 text-xs hover:text-white/80 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCleaningDuplicates ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Scanning…</>
                  ) : (
                    "Clean duplicates"
                  )}
                </button>
              </div>
            </div>

            {/* Images Grid */}
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2">
              {filteredImages.map((image) => {
                const isSelected = selectedImages.has(image.public_id);
                return (
                  <div
                    key={image.public_id}
                    className={`relative mb-2 break-inside-avoid cursor-pointer overflow-hidden rounded ${
                      isSelected ? "ring-2 ring-white" : ""
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
                      loading="lazy"
                    />

                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-black" strokeWidth={3} />
                        </div>
                      </div>
                    )}

                    {image.context?.collection && (
                      <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-white/90 text-[10px] font-medium pointer-events-none">
                        {image.context.collection}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredImages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/40 text-sm">
                  {selectedCollection
                    ? `No photos in "${selectedCollection}"`
                    : "No photos yet"}
                </p>
              </div>
            )}

            {/* Sticky Actions Bar (mobile-first) */}
            {selectedImages.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-white/10 px-3 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/80 text-xs font-medium px-2">
                    {selectedImages.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedImages(new Set())}
                    className="text-white/50 text-xs hover:text-white/80 px-2"
                  >
                    Clear
                  </button>

                  <div className="flex-1" />

                  <input
                    type="text"
                    placeholder="Collection name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="bg-white/10 border border-white/15 rounded-full px-3 py-1.5 text-white text-xs placeholder-white/40 w-32"
                  />
                  <button
                    onClick={addToCollection}
                    disabled={isLoading || !newCollectionName.trim()}
                    className="bg-white text-black px-3 py-1.5 text-xs rounded-full hover:bg-white/90 transition-colors disabled:opacity-50 font-medium"
                  >
                    Add to collection
                  </button>
                  <button
                    onClick={removeFromCollection}
                    disabled={isLoading}
                    className="bg-white/10 text-white px-3 py-1.5 text-xs rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                  <button
                    onClick={deleteSelectedImages}
                    disabled={isLoading}
                    className="bg-red-600/90 text-white px-3 py-1.5 text-xs rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collections Tab */}
        {activeTab === "collections" && (
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {collections.map((collection) => (
                <button
                  key={collection.name}
                  className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-white/40 transition-all text-left"
                  onClick={() => {
                    setSelectedCollection(collection.name);
                    setActiveTab("manage");
                  }}
                >
                  {collection.cover_image && (
                    <Image
                      src={collection.cover_image}
                      alt={collection.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="text-white font-medium text-sm capitalize truncate">
                      {collection.name}
                    </h3>
                    <p className="text-white/60 text-xs tabular-nums">
                      {collection.count} photo{collection.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {collections.length === 0 && (
              <div className="text-center py-16">
                <p className="text-white/40 text-sm">No collections yet</p>
                <p className="text-white/40 text-xs mt-2 max-w-xs mx-auto">
                  Select photos in the Manage tab and add them to a new collection.
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
        className="hidden"
        onChange={handleFileSelect}
      />
    </main>
  );
}
