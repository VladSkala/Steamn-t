import { useState } from "react";

function ImageContent({ src, alt, priority }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="media-placeholder"
      role="img"
      aria-label={alt || "Artwork unavailable"}
    >
      <svg viewBox="0 0 80 56" aria-hidden="true">
        <path d="M2 50 25 16 42 38 55 25 78 50Z" />
        <circle cx="60" cy="12" r="7" />
      </svg>
      <span>Artwork unavailable</span>
    </span>
  );
}

export default function GameImage({
  src,
  alt = "",
  className = "",
  priority = false,
}) {
  return (
    <div className={`media-artwork ${className}`}>
      <ImageContent
        key={src || "empty"}
        src={src}
        alt={alt}
        priority={priority}
      />
    </div>
  );
}
