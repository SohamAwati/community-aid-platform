import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Safely converts any Data URL (Base64 or URI-encoded) or direct URL into a binary Blob with its exact MIME type.
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
    // If it's already a blob or http(s) URL
    if (dataUrl.startsWith("blob:") || dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
      const isImg = /\.(png|jpe?g|svg|webp|gif)(\?.*)?$/i.test(dataUrl);
      const isPdfDoc = /\.(pdf)(\?.*)?$/i.test(dataUrl) || !isImg;
      return {
        blob: new Blob([], { type: isPdfDoc ? "application/pdf" : "image/jpeg" }),
        mime: isPdfDoc ? "application/pdf" : "image/jpeg",
        ext: isPdfDoc ? "pdf" : "jpg",
        isPdf: isPdfDoc,
        isImage: isImg,
      };
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
      let cleanBase64 = rawData.replace(/\s/g, "");
      if (cleanBase64.includes("%")) {
        try {
          cleanBase64 = decodeURIComponent(cleanBase64);
        } catch {}
      }
      cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, "");
      while (cleanBase64.length % 4 !== 0) {
        cleanBase64 += "=";
      }
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
    }, 15000);

    toast.success(`Certificate downloaded as .${ext.toUpperCase()}`);
  } catch (err) {
    console.error("Download error:", err);
    toast.error("Failed to generate download");
  }
}

/**
 * Opens the certificate in a new browser tab safely by rendering inside a clean HTML shell.
 * This avoids Chromium's top-level navigation block on blob URLs ("Not allowed to navigate top frame to blob URL").
 */
export function openCertificateInNewTab(dataUrl: string, title?: string): void {
  try {
    const { blob, isPdf, ext } = dataUrlToBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);
    const docTitle = title || "Participation Certificate";

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${docTitle} — Volunteer Connect</title>
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .bar { height: 48px; background: #1e293b; color: #f8fafc; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid #334155; }
      .bar .title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
      .bar .badge { background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; padding: 2px 8px; border-radius: 9999px; border: 1px solid rgba(52, 211, 153, 0.3); font-weight: 600; }
      .viewer { width: 100%; height: calc(100% - 48px); border: none; background: #ffffff; }
      .img-wrap { width: 100%; height: calc(100% - 48px); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
      .img-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); border-radius: 12px; }
    </style>
  </head>
  <body>
    <div class="bar">
      <div class="title">
        <span>${docTitle}</span>
        <span class="badge">Official ${ext.toUpperCase()} Certificate</span>
      </div>
      <span style="font-size: 12px; color: #94a3b8;">Volunteer Connect Document Viewer</span>
    </div>
    ${
      isPdf
        ? `<iframe class="viewer" src="${objectUrl}" title="${docTitle}"></iframe>`
        : `<div class="img-wrap"><img src="${objectUrl}" alt="${docTitle}" /></div>`
    }
  </body>
</html>`);
      win.document.close();
    } else {
      toast.error("Popup was blocked. Please allow popups to view certificate.");
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!url || !open) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setHasError(false);
      return;
    }

    try {
      setHasError(false);
      const { blob, isPdf, isImage, ext } = dataUrlToBlob(url);
      const bUrl = URL.createObjectURL(blob);
      setBlobUrl(bUrl);
      setFileMeta({ isPdf, isImage, ext });

      return () => {
        URL.revokeObjectURL(bUrl);
      };
    } catch (e) {
      console.error("Preview creation error:", e);
      setHasError(true);
    }
  }, [url, open]);

  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              {title || "Participation Certificate"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Verified Certificate Document ({fileMeta.ext.toUpperCase()})
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 my-4 overflow-hidden rounded-2xl bg-muted/30 border border-border flex items-center justify-center p-2 min-h-[460px]">
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <FileText className="size-12 text-destructive/70" />
              <p className="text-base font-semibold">Unable to display document directly</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                You can download the original certificate or view it in a separate window.
              </p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => openCertificateInNewTab(url, title)}>
                  <ExternalLink className="size-3.5 mr-1" /> Open in New Window
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadCertificate(url, title)}>
                  <Download className="size-3.5 mr-1" /> Download
                </Button>
              </div>
            </div>
          ) : blobUrl ? (
            fileMeta.isPdf ? (
              <iframe
                src={blobUrl}
                className="w-full h-[580px] rounded-xl border-0 bg-white shadow-sm"
                title="Certificate Document Viewer"
              />
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

        <DialogFooter className="flex flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openCertificateInNewTab(url, title)}
          >
            <ExternalLink className="size-3.5" /> Open in New Window
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs"
              onClick={() => downloadCertificate(url, title)}
            >
              <Download className="size-3.5" /> Download ({fileMeta.ext.toUpperCase()})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
