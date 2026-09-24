import { useEffect, useRef, useState } from "react";
import { t, useLocale } from "../i18n/index.js";

function OriginalImage({ image }) {
  const [status, setStatus] = useState("loading");
  return <>
    {status !== "error" && <img src={image.src} alt={image.alt || ""} draggable="false" onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />}
    {status !== "ready" && <span className="image-lightbox-status" role={status === "error" ? "alert" : "status"}>
      {t(status === "error" ? "Image could not be loaded." : "Loading image…")}
    </span>}
  </>;
}

export default function ImageLightbox({ images, index = 0, onIndexChange, onClose, label }) {
  useLocale();
  const dialogRef = useRef(null);
  const pointerStartRef = useRef(null);
  const safeImages = Array.isArray(images) ? images.filter(image => image?.src) : [];
  const activeIndex = safeImages.length ? ((index % safeImages.length) + safeImages.length) % safeImages.length : 0;
  const active = safeImages[activeIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof dialog?.showModal === "function") dialog.showModal();
    else dialog?.setAttribute("open", "");
    dialog?.focus();
    return () => {
      if (dialog?.open && typeof dialog.close === "function") dialog.close();
      else dialog?.removeAttribute("open");
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  if (!active) return null;
  const move = direction => onIndexChange?.((activeIndex + direction + safeImages.length) % safeImages.length);
  const previousLabel = t("Previous image");
  const nextLabel = t("Next image");
  return <dialog
    ref={dialogRef}
    className="image-lightbox"
    tabIndex={-1}
    aria-label={label || t("Image viewer")}
    aria-modal="true"
    onCancel={event => {
      event.preventDefault();
      onClose();
    }}
    onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }}
    onKeyDown={event => {
      if (event.key === "ArrowLeft" && safeImages.length > 1) {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "ArrowRight" && safeImages.length > 1) {
        event.preventDefault();
        move(1);
      }
    }}
  >
    <div className="image-lightbox-stage" onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }} onPointerDown={event => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }} onPointerCancel={() => {
      pointerStartRef.current = null;
    }} onPointerUp={event => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start || start.id !== event.pointerId || safeImages.length < 2) return;
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) move(deltaX > 0 ? -1 : 1);
    }}>
      <OriginalImage key={active.src} image={active} />
    </div>
    {safeImages.length > 1 && <div className="image-lightbox-controls">
      <button type="button" onClick={() => move(-1)} aria-label={previousLabel} title={previousLabel}>←</button>
      <span aria-live="polite">{activeIndex + 1} / {safeImages.length}</span>
      <button type="button" onClick={() => move(1)} aria-label={nextLabel} title={nextLabel}>→</button>
    </div>}
  </dialog>;
}
