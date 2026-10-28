"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Paperclip,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  X,
  Play,
  FileArchive,
  FileCode,
  Eye,
  Plus,
  File,
  Sparkles,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import type { AttachmentDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "primereact/dialog";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string, fileName: string) {
  if (type === "image" || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName)) {
    return <ImageIcon className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
  if (type === "video" || /\.(mp4|webm|mov|avi|mkv|wmv|flv)$/i.test(fileName)) {
    return <Video className="h-4 w-4 text-purple-600 shrink-0" />;
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) {
    return <FileArchive className="h-4 w-4 text-amber-600 shrink-0" />;
  }
  if (/\.(json|js|ts|py|c|cpp|cs|html|css|log|sql)$/i.test(fileName)) {
    return <FileCode className="h-4 w-4 text-blue-600 shrink-0" />;
  }
  return <FileText className="h-4 w-4 text-cyan-600 shrink-0" />;
}

interface ProjectAttachmentGalleryProps {
  projectId: string;
  attachments?: AttachmentDto[];
  onAttachmentsChanged?: () => void;
  canUpload?: boolean;
  canDelete?: boolean;
  compact?: boolean;
}

export function ProjectAttachmentGallery({
  projectId,
  attachments: propAttachments,
  onAttachmentsChanged,
  canUpload = true,
  canDelete = true,
  compact = false,
}: ProjectAttachmentGalleryProps) {
  const [internalAttachments, setInternalAttachments] = useState<AttachmentDto[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewMedia, setPreviewMedia] = useState<AttachmentDto | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "IMAGE" | "VIDEO" | "DOC">("ALL");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchInternalAttachments = useCallback(async () => {
    if (!projectId) return;
    setLoadingInternal(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setInternalAttachments(data.attachments || []);
      }
    } catch (err) {
      console.error("Lỗi tải attachments nội bộ:", err);
    } finally {
      setLoadingInternal(false);
    }
  }, [projectId]);

  // Không mirror `propAttachments` vào state: biến `attachments` bên dưới đã
  // ưu tiên prop khi có, nên setState ở đây chỉ tạo thêm một lượt render.
  // Chỉ fetch khi component tự quản lý danh sách (không được truyền prop).
  useEffect(() => {
    if (propAttachments === undefined && projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được async
      fetchInternalAttachments();
    }
  }, [propAttachments, projectId, fetchInternalAttachments]);

  const attachments = propAttachments !== undefined ? propAttachments : internalAttachments;

  const images = attachments.filter(
    (a) => a.fileType === "image" || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(a.fileName)
  );
  const videos = attachments.filter(
    (a) => a.fileType === "video" || /\.(mp4|webm|mov|avi|mkv|wmv|flv)$/i.test(a.fileName)
  );
  const docs = attachments.filter(
    (a) =>
      a.fileType !== "image" &&
      a.fileType !== "video" &&
      !/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|wmv|flv)$/i.test(a.fileName)
  );

  const filteredAttachments = attachments.filter((a) => {
    if (filterType === "IMAGE") return a.fileType === "image" || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(a.fileName);
    if (filterType === "VIDEO") return a.fileType === "video" || /\.(mp4|webm|mov|avi|mkv|wmv|flv)$/i.test(a.fileName);
    if (filterType === "DOC") return a.fileType !== "image" && a.fileType !== "video" && !/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|wmv|flv)$/i.test(a.fileName);
    return true;
  });

  async function handleFilesUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;

    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await fetch(`/api/projects/${projectId}/attachments`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setUploadError(data?.error || "Không thể tải lên tài liệu");
      } else {
        if (onAttachmentsChanged) {
          onAttachmentsChanged();
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải lên file dự án:", err);
      setUploadError("Lỗi kết nối khi tải lên tài liệu");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!confirm("Bạn có chắc muốn xóa tài liệu này khỏi dự án?")) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        if (onAttachmentsChanged) {
          onAttachmentsChanged();
        }
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Không thể xóa tài liệu");
      }
    } catch (err) {
      console.error("Lỗi khi xóa attachment dự án:", err);
    }
  }

  return (
    <div className="space-y-3.5">
      {/* Header & Upload Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent font-bold">
            <Paperclip className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Tài Liệu, Hình Ảnh & Video Dự Án</span>
              <span className="rounded-full bg-accent/15 text-accent px-2 py-0.2 text-[10px] font-mono font-bold">
                {attachments.length} tệp
              </span>
            </div>
            <div className="text-[10px] text-muted">
              {images.length} ảnh • {videos.length} video • {docs.length} tài liệu đặc tả
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Filter Buttons */}
          {attachments.length > 0 && (
            <div className="flex items-center rounded-lg bg-surface-2 p-0.5 border border-line text-[10px]">
              <button
                type="button"
                onClick={() => setFilterType("ALL")}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  filterType === "ALL" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                Tất cả ({attachments.length})
              </button>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType("IMAGE")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterType === "IMAGE" ? "bg-surface text-emerald-600 shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  Ảnh ({images.length})
                </button>
              )}
              {videos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType("VIDEO")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterType === "VIDEO" ? "bg-surface text-purple-600 shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  Video ({videos.length})
                </button>
              )}
              {docs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType("DOC")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterType === "DOC" ? "bg-surface text-blue-600 shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  Tài liệu ({docs.length})
                </button>
              )}
            </div>
          )}

          {canUpload && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.log,.zip,.rar,.json,.sql"
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-7.5 text-xs font-bold px-3 bg-accent hover:bg-accent/90 text-white shadow-sm shadow-accent/20 cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1 stroke-[2.5]" />
                )}
                Tải tệp lên
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Error alert */}
      {uploadError && (
        <div className="p-2.5 rounded-xl bg-accent-subtle border border-accent/30 text-accent text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesUpload(e.dataTransfer.files);
            }
          }}
          onClick={() => attachments.length === 0 && fileInputRef.current?.click()}
          className={`transition-all rounded-xl border border-dashed text-center ${
            compact ? "p-3" : "p-4"
          } ${
            dragOver
              ? "border-accent bg-accent/15 ring-2 ring-accent/30"
              : attachments.length === 0
              ? "border-line bg-surface-2/40 hover:bg-surface-2 hover:border-accent/50 cursor-pointer"
              : "border-line/60 bg-surface-2/20 hover:border-accent/40"
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-accent animate-pulse py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang lưu trữ và đồng bộ tài liệu dự án...</span>
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-surface-3 text-emerald-600 border border-line">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="p-1.5 rounded-lg bg-surface-3 text-purple-600 border border-line">
                  <Video className="w-4 h-4" />
                </div>
                <div className="p-1.5 rounded-lg bg-surface-3 text-blue-600 border border-line">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xs font-bold text-foreground">
                Kéo thả tài liệu, ảnh hoặc video đặc tả dự án vào đây
              </div>
              <div className="text-[10px] text-muted">
                Hỗ trợ PNG, JPG, MP4, WebM, MOV, PDF, Word, Excel, PowerPoint, Zip, Logs (Tối đa 25MB/ảnh & tài liệu, 100MB/video)
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted flex items-center justify-center gap-1.5 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 text-accent" />
              <span>Kéo thả thêm tệp vào đây hoặc <strong className="text-accent underline font-semibold">chọn từ máy tính</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Grid: Images & Videos */}
      {(filterType === "ALL" || filterType === "IMAGE" || filterType === "VIDEO") &&
        (images.length > 0 || videos.length > 0) && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-xl border border-line bg-surface overflow-hidden aspect-video flex items-center justify-center shadow-sm hover:shadow-md transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.fileUrl}
                    alt={img.fileName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] text-white font-medium truncate max-w-[80%]" title={img.fileName}>
                        {img.fileName}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAttachment(img.id);
                          }}
                          className="p-1 rounded-lg bg-red-500/80 hover:bg-red-600 text-white cursor-pointer transition-colors"
                          title="Xóa tệp này"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-white/80">
                        {formatFileSize(img.fileSize)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewMedia(img)}
                          className="px-2 py-0.5 rounded bg-white/25 hover:bg-white/40 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer backdrop-blur-sm"
                        >
                          <Eye className="h-3 w-3" /> Xem
                        </button>
                        <a
                          href={img.fileUrl}
                          download={img.fileName}
                          className="p-1 rounded bg-white/25 hover:bg-white/40 text-white cursor-pointer backdrop-blur-sm"
                          title="Tải về"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {videos.map((vid) => (
                <div
                  key={vid.id}
                  className="group relative rounded-xl border border-line bg-surface-3 overflow-hidden aspect-video flex flex-col items-center justify-center shadow-sm"
                >
                  <Video className="h-8 w-8 text-purple-400 opacity-80 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] text-foreground font-semibold truncate max-w-[90%] px-2 mt-1">
                    {vid.fileName}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] text-purple-300 font-mono">
                        {formatFileSize(vid.fileSize)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAttachment(vid.id);
                          }}
                          className="p-1 rounded-lg bg-red-500/80 hover:bg-red-600 text-white cursor-pointer transition-colors"
                          title="Xóa video này"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewMedia(vid)}
                        className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-lg"
                      >
                        <Play className="h-3 w-3 fill-current" /> Phát video
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* List: Documents, Archives & Code/Data files */}
      {(filterType === "ALL" || filterType === "DOC") && docs.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="divide-y divide-line/60 rounded-xl border border-line bg-surface overflow-hidden shadow-sm">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2.5 hover:bg-surface-2/60 transition-colors text-xs group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                  <div className="p-1.5 rounded-lg bg-surface-2 border border-line shrink-0">
                    {getFileIcon(doc.fileType, doc.fileName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate group-hover:text-accent transition-colors" title={doc.fileName}>
                      {doc.fileName}
                    </div>
                    <div className="text-[10px] text-muted font-mono flex items-center gap-2 mt-0.5">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      {doc.uploader && (
                        <span className="text-foreground/80 flex items-center gap-1">
                          • {doc.uploader.name}
                        </span>
                      )}
                      <span>• {new Date(doc.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.fileUrl}
                    download={doc.fileName}
                    className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground cursor-pointer transition-colors"
                    title="Tải về tệp này"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-accent cursor-pointer transition-colors"
                    title="Mở tệp trong tab mới"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteAttachment(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-accent-subtle text-muted hover:text-accent cursor-pointer transition-colors"
                      title="Xóa tệp khỏi dự án"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox / Video Modal */}
      <Dialog
        header={previewMedia?.fileName || "Xem trước tài liệu dự án"}
        visible={Boolean(previewMedia)}
        onHide={() => setPreviewMedia(null)}
        className="w-full max-w-4xl border border-line bg-surface rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-3 flex flex-col items-center justify-center max-h-[75vh] overflow-auto">
          {previewMedia?.fileType === "image" ||
          /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(previewMedia?.fileName || "") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewMedia?.fileUrl}
              alt={previewMedia?.fileName}
              className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-md"
            />
          ) : (
            <video
              src={previewMedia?.fileUrl}
              controls
              autoPlay
              className="max-h-[70vh] max-w-full rounded-xl shadow-md bg-black"
            >
              Trình duyệt của bạn không hỗ trợ phát video.
            </video>
          )}

          <div className="flex items-center justify-between w-full pt-3 px-2 text-xs text-muted border-t border-line mt-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-foreground">{previewMedia?.fileName}</span>
              <span className="font-mono">({formatFileSize(previewMedia?.fileSize)})</span>
            </div>
            <a
              href={previewMedia?.fileUrl}
              download={previewMedia?.fileName}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-accent text-white font-bold hover:bg-accent/90 cursor-pointer shadow-md shadow-accent/20"
            >
              <Download className="h-3.5 w-3.5" /> Tải tệp xuống
            </a>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
