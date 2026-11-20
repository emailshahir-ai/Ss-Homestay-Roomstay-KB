import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '', onClick }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center ${className}`}
      >
        <ImageOff className="w-6 h-6 mb-2 opacity-60" />
        <span className="text-xs font-medium text-slate-500 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      onClick={onClick}
      className={className}
    />
  );
};
