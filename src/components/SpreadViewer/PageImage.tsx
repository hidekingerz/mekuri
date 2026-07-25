type PageImageProps = {
  src: string | null;
  alt: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
};

export function PageImage({ src, alt, onLoad }: PageImageProps) {
  if (!src) {
    return <div className="page-image page-image--empty" />;
  }

  return <img className="page-image" src={src} alt={alt} draggable={false} onLoad={onLoad} />;
}
