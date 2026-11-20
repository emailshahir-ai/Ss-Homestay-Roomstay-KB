import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SafeImage } from './SafeImage';

export interface LightboxImage {
  src: string;
  alt: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  useEffect(() => {
    if (currentIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate((currentIndex + 1) % images.length);
      if (e.key === 'ArrowLeft') onNavigate((currentIndex - 1 + images.length) % images.length);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length, onClose, onNavigate]);

  if (currentIndex === null || !images[currentIndex]) return null;

  const current = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
        aria-label="Tutup paparan gambar"
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex - 1 + images.length) % images.length);
            }}
            className="absolute left-3 sm:left-6 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Gambar sebelumnya"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex + 1) % images.length);
            }}
            className="absolute right-3 sm:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Gambar seterusnya"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="flex max-h-[88vh] max-w-5xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <SafeImage
          src={current.src}
          alt={current.alt}
          className="max-h-[78vh] w-auto rounded-lg object-contain shadow-2xl"
        />
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-300">
          <span>{current.alt}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num text-xs text-slate-400">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      </div>
    </div>
  );
};
