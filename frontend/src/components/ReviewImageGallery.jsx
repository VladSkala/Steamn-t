import { useState } from "react";
import { t, useLocale } from "../i18n/index.js";
import ImageLightbox from "./ImageLightbox";

const sourceOf = image => typeof image === "string" ? image : image?.image || image?.src || image?.preview || "";

export default function ReviewImageGallery({
  images,
  title,
  className = "review-image-gallery",
  itemClassName = "review-image-item",
  editable = false,
  onRemove,
  removeLabel,
  previewLimit = Infinity
}) {
  useLocale();
  const [activeIndex, setActiveIndex] = useState(null);
  const originals = Array.isArray(images) ? images.filter(sourceOf) : [];
  if (!originals.length) return null;
  const galleryTitle = title || t("Review images");
  const normalized = originals.map((image, index) => ({
    src: sourceOf(image),
    alt: image?.alt || t("Review image {index}", { index: index + 1 })
  }));
  const visible = originals.slice(0, Math.max(1, previewLimit));
  const hiddenCount = Math.max(0, originals.length - visible.length);
  return <>
    <div className={className} aria-label={galleryTitle}>
      {visible.map((image, index) => {
        const key = image?.key || image?.id || sourceOf(image);
        const openLabel = t("View image {index}: {title}", { index: index + 1, title: galleryTitle });
        const deleteLabel = typeof removeLabel === "function" ? removeLabel(image, index) : removeLabel || t("Remove review image {index}", { index: index + 1 });
        return <figure className={itemClassName} key={key}>
          <button type="button" className="review-image-open" onClick={() => setActiveIndex(index)} aria-label={openLabel} title={openLabel}>
            <img src={normalized[index].src} alt={normalized[index].alt} loading="lazy" decoding="async" />
            {hiddenCount > 0 && index === visible.length - 1 && <span className="review-image-more" aria-hidden="true">+{hiddenCount}</span>}
          </button>
          {editable && onRemove && <button type="button" className="review-image-remove" onClick={() => onRemove(image, index)} aria-label={deleteLabel} title={deleteLabel}>×</button>}
        </figure>;
      })}
    </div>
    {activeIndex !== null && <ImageLightbox images={normalized} index={activeIndex} onIndexChange={setActiveIndex} onClose={() => setActiveIndex(null)} label={galleryTitle} />}
  </>;
}
