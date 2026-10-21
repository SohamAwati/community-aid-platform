import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Eye } from "lucide-react";
import { toast } from "sonner";

/**
 * Safely converts any Data URL (Base64 or URI-encoded) or plain string to a binary Blob with its exact MIME type.
 * Inspects both header tokens and binary magic bytes to guarantee proper decoding.
 */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string; ext: string; isPdf: boolean; isImage: boolean } {
  if (!dataUrl || typeof dataUrl !== "string") {
    const emptyBlob = new Blob([], { type: "application/pdf" });
    return { blob: emptyBlob, mime: "application/pdf", ext: "pdf", isPdf: true, isImage: false };
  }

  // Handle plain SVG string without data: prefix
  if (!dataUrl.startsWith("data:")) {
    if (dataUrl.includes("<svg")) {
      const blob = new Blob([dataUrl], { type: "image/svg+xml" });
      return { blob, mime: "image/svg+xml", ext: "svg", isPdf: false, isImage: true };
    }
    const blob = new Blob([dataUrl], { type: "application/pdf" });
    return { blob, mime: "application/pdf", ext: "pdf", isPdf: true, isImage: false };
  }

  // Parse RFC 2397 data URL: data:[<mediatype>][;param=val...][;base64],<data>
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    const blob = new Blob([dataUrl], { type: "application/pdf" });
    return { blob, mime: "application/pdf", ext: "pdf", isPdf: true, isImage: false };
  }

  const metaPart = dataUrl.slice(5, commaIdx); // everything between 'data:' and ','
  const rawData = dataUrl.slice(commaIdx + 1);

  const metaTokens = metaPart.split(";");
  let mime = (metaTokens[0] || "").toLowerCase().trim();
  const isBase64 = metaTokens.slice(1).some((t) => t.trim().toLowerCase() === "base64");

  let bytes: Uint8Array;
  if (isBase64) {
    try {
      const cleanBase64 = rawData.replace(/\s/g, "");
      const binStr = atob(cleanBase64);
      const len = binStr.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
    } catch (e) {
      console.warn("Base64 decode failed, falling back to text encoder", e);
      bytes = new TextEncoder().encode(rawData);
    }
  } else {
    try {
      const decoded = decodeURIComponent(rawData);
      bytes = new TextEncoder().encode(decoded);
    } catch {
      bytes = new TextEncoder().encode(rawData);
    }
  }

  // Sniff magic bytes
  const isPdf =
    (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) || // %PDF
    mime.includes("pdf");
  const isPng =
    (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    mime.includes("png");
  const isJpg =
    (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    mime.includes("jpeg") ||
    mime.includes("jpg");
  const isSvg =
    mime.includes("svg") ||
    rawData.includes("<svg") ||
    new TextDecoder().decode(bytes.slice(0, 100)).includes("<svg");
  const isWebp =
    mime.includes("webp") ||
    (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);

  let ext = "pdf";
  let finalMime = mime || "application/pdf";

  if (isPdf) {
    ext = "pdf";
    finalMime = "application/pdf";
  } else if (isPng) {
    ext = "png";
    finalMime = "image/png";
  } else if (isJpg) {
    ext = "jpg";
    finalMime = "image/jpeg";
  } else if (isSvg) {
    ext = "svg";
    finalMime = "image/svg+xml";
  } else if (isWebp) {
    ext = "webp";
    finalMime = "image/webp";
  }

  const blob = new Blob([bytes], { type: finalMime });
  return {
    blob,
    mime: finalMime,
    ext,
    isPdf,
    isImage: isPng || isJpg || isSvg || isWebp,
  };
}

/**
 * Downloads the certificate cleanly by generating a native Blob URL with the correct binary format and extension.
 */
export function downloadCertificate(dataUrl: string, title?: string): void {
  try {
    const { blob, ext } = dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    const cleanTitle = (title || "certificate")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `certificate-${cleanTitle || "volunteer"}.${ext}`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    }, 10000);

    toast.success(`Certificate downloaded as .${ext.toUpperCase()}`);
  } catch (err) {
    console.error("Download error:", err);
    toast.error("Failed to generate download");
  }
}

/**
 * Opens the certificate in a new browser tab using a native Blob URL so the browser can view it natively.
 */
export function openCertificateInNewTab(dataUrl: string): void {
  try {
    const { blob } = dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    const win = window.open(objectUrl, "_blank");
    if (!win) {
      toast.error("Popup was blocked. Please allow popups to view the certificate in a new tab.");
    }
  } catch (err) {
    console.error("Open in new tab error:", err);
    toast.error("Could not open certificate");
  }
}

/**
 * Interactive In-App Certificate Preview Modal Component
 */
export function CertificatePreviewDialog({
  open,
  onOpenChange,
  url,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ isPdf: boolean; isImage: boolean; ext: string }>({
    isPdf: true,
    isImage: false,
    ext: "pdf",
  });

  useEffect(() => {
    if (!url || !open) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      return;
    }

    try {
      const { blob, isPdf, isImage, ext } = dataUrlToBlob(url);
      const bUrl = URL.createObjectURL(blob);
      setBlobUrl(bUrl);
      setFileMeta({ isPdf, isImage, ext });

      return () => {
        URL.revokeObjectURL(bUrl);
      };
    } catch (e) {
      console.error("Preview creation error:", e);
    }
  }, [url, open]);

  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">
          <div>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              {title || "Participation Certificate"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified document uploaded by host NGO partner ({fileMeta.ext.toUpperCase()} document)
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 my-4 overflow-auto rounded-2xl bg-muted/30 border border-border flex items-center justify-center p-3 min-h-[440px]">
          {blobUrl ? (
            fileMeta.isPdf ? (
              <object
                data={`${blobUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="w-full h-[580px] rounded-xl border border-border/80 bg-white"
                title="Certificate PDF Viewer"
              >
                <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
                  <FileText className="size-12 text-primary/70" />
                  <p className="text-base font-semibold">PDF Ready to View</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Click below to open the PDF document in a new tab or download it directly to your device.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => openCertificateInNewTab(url)}>
                      <ExternalLink className="size-3.5 mr-1" /> Open in New Tab
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadCertificate(url, title)}>
                      <Download className="size-3.5 mr-1" /> Download
                    </Button>
                  </div>
                </div>
              </object>
            ) : (
              <img
                src={blobUrl}
                alt={title || "Certificate"}
                className="max-h-[580px] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            )
          ) : (
            <div className="text-sm text-muted-foreground animate-pulse">Loading document preview...</div>
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between gap-3 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openCertificateInNewTab(url)}
          >
            <ExternalLink className="size-3.5" /> Open in New Tab
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={() => downloadCertificate(url, title)}
            >
              <Download className="size-3.5" /> Download File
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
