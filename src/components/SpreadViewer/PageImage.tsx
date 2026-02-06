interface PageImageProps {
  src: string | null;
  alt: string;
}

export function PageImage({ src, alt }: PageImageProps) {
  if (!src) {
    return <div className="page-image page-image--empty" />;
  }

  return <img className="page-image" src={src} alt={alt} draggable={false} />;
}
