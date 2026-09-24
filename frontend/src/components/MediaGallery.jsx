import { t, useLocale } from "../i18n/index.js";
import { useState } from "react";
import GameImage from "./GameImage";
import ImageLightbox from "./ImageLightbox";
export default function MediaGallery({
  images,
  title
}) {
  useLocale();
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const activeIndex = index % Math.max(images.length, 1);
  const active = images[activeIndex];
  if (!active) return <GameImage className="store-gallery-main" alt={t("Artwork for {title}", { title })} />;
  return <div className="store-gallery">
      <button type="button" className="store-gallery-main" onClick={() => setViewerOpen(true)} aria-label={t("Enlarge image: {title}", { title: active.alt })}>
        <GameImage className="media-artwork-contained" src={active.src} alt={active.alt} priority />
        <span className="store-gallery-expand" aria-hidden="true">
          ↗
        </span>
      </button>
      {images.length > 1 && <div className="store-gallery-thumbs" aria-label={t("Game images")}>
          {images.map((image, imageIndex) => <button type="button" key={`${image.src}-${imageIndex}`} aria-label={t("View image {index}: {title}", { index: imageIndex + 1, title: image.alt })} aria-pressed={imageIndex === activeIndex} className={imageIndex === activeIndex ? "active" : ""} onClick={() => setIndex(imageIndex)}>
              <GameImage className="media-artwork-contained" src={image.src} alt="" />
            </button>)}
        </div>}
      {viewerOpen && <ImageLightbox images={images} index={activeIndex} onIndexChange={setIndex} onClose={() => setViewerOpen(false)} label={t("Game screenshots")} />}
    </div>;
}
