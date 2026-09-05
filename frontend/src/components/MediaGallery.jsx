import { useEffect, useRef, useState } from "react";
import GameImage from "./GameImage";

function ImageViewer({ image, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="store-image-viewer"
      aria-label={image.alt}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="store-viewer-close"
        onClick={onClose}
        aria-label="Close image"
      >
        ×
      </button>
      <GameImage src={image.src} alt={image.alt} priority />
      <p>{image.alt}</p>
    </dialog>
  );
}

export default function MediaGallery({ images, title }) {
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const activeIndex = index % Math.max(images.length, 1);
  const active = images[activeIndex];
  if (!active)
    return (
      <GameImage className="store-gallery-main" alt={`Artwork for ${title}`} />
    );
  return (
    <div className="store-gallery">
      <button
        type="button"
        className="store-gallery-main"
        onClick={() => setViewerOpen(true)}
        aria-label={`Enlarge image: ${active.alt}`}
      >
        <GameImage src={active.src} alt={active.alt} priority />
        <span className="store-gallery-expand" aria-hidden="true">
          ↗
        </span>
      </button>
      {images.length > 1 && (
        <div className="store-gallery-thumbs" aria-label="Game images">
          {images.map((image, imageIndex) => (
            <button
              type="button"
              key={`${image.src}-${imageIndex}`}
              aria-label={`View image ${imageIndex + 1}: ${image.alt}`}
              aria-pressed={imageIndex === activeIndex}
              className={imageIndex === activeIndex ? "active" : ""}
              onClick={() => setIndex(imageIndex)}
            >
              <GameImage src={image.src} alt="" />
            </button>
          ))}
        </div>
      )}
      {viewerOpen && (
        <ImageViewer image={active} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  );
}
