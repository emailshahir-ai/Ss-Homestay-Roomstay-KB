import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { CONTACT_INFO } from '../data/homestayData';

interface OgCheckData {
  ok: boolean;
  origin: string;
  ogUrl: string;
  ogImage: string;
  title: string;
  description: string;
}

const DEFAULT_PROMO_TEXT =
  'Jemput menginap di *SS Homestay & Roomstay*, Kg Padang Enggang, Kota Bharu, Kelantan!\n• Private Pool + 3 Bilik Air-Cond (RM300/mlm)\n• Roomstay Selesa (RM130/mlm)\n• Pakej Kombo Homestay & Roomstay (RM400/mlm)\n\nSemak tarikh kosong & tempah terus di sini:';

export const WhatsAppShareCard: React.FC = () => {
  const detectedOrigin = useMemo(() => {
    if (typeof window === 'undefined') return CONTACT_INFO.websiteUrl;
    return window.location.origin;
  }, []);

  const [shareUrl, setShareUrl] = useState<string>(() => detectedOrigin);
  const [promoText, setPromoText] = useState<string>(DEFAULT_PROMO_TEXT);
  const [copiedType, setCopiedType] = useState<'url' | 'fresh' | 'full' | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [ogStatus, setOgStatus] = useState<OgCheckData | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/og-check')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OgCheckData | null) => {
        if (active && data?.ok) {
          setOgStatus(data);
        }
      })
      .catch(() => {
        // Ignore if running in static-only preview
      });
    return () => {
      active = false;
    };
  }, []);

  const cleanShareUrl = shareUrl.trim() || CONTACT_INFO.websiteUrl;
  const displayDomain = useMemo(() => {
    try {
      return new URL(cleanShareUrl).host;
    } catch {
      return cleanShareUrl.replace(/^https?:\/\//i, '');
    }
  }, [cleanShareUrl]);

  const fullWhatsAppMessage = `${promoText.trim()}\n${cleanShareUrl}`;
  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(fullWhatsAppMessage)}`;

  const showTempCopied = (type: 'url' | 'fresh' | 'full') => {
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2200);
  };

  const handleCopyText = async (text: string, type: 'url' | 'fresh' | 'full') => {
    try {
      await navigator.clipboard.writeText(text);
      showTempCopied(type);
    } catch {
      setShareFeedback('Tidak dapat menyalin secara automatik. Sila salin pautan secara manual.');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const handleCopyFreshUrl = () => {
    const separator = cleanShareUrl.includes('?') ? '&' : '?';
    const freshUrl = `${cleanShareUrl}${separator}v=${Math.floor(Date.now() / 1000) % 10000}`;
    handleCopyText(freshUrl, 'fresh');
  };

  const handleNativeShareWithLogo = async () => {
    setShareFeedback(null);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const res = await fetch('/ss-homestay-icon-512.jpg');
        const blob = await res.blob();
        const logoFile = new File([blob], 'logo-ss-homestay.jpg', { type: 'image/jpeg' });

        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [logoFile] })) {
          await navigator.share({
            title: 'SS Homestay & Roomstay — Kota Bharu, Kelantan',
            text: fullWhatsAppMessage,
            files: [logoFile],
          });
          setShareFeedback('Berjaya membuka menu kongsi bersama logo dan pautan.');
          setTimeout(() => setShareFeedback(null), 3000);
          return;
        }

        await navigator.share({
          title: 'SS Homestay & Roomstay — Kota Bharu, Kelantan',
          text: promoText.trim(),
          url: cleanShareUrl,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Fallback on desktop: open WhatsApp share link in new tab
    const link = document.createElement('a');
    link.href = whatsappShareHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Kongsi Pautan WhatsApp (Logo &amp; Keterangan Automatik)
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Pelayan aplikasi ini kini menjana tag OpenGraph secara automatik mengikut URL awam anda supaya logo dan keterangan muncul apabila ditampal di WhatsApp.
          </p>
        </div>
        {ogStatus?.ok && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 whitespace-nowrap shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>OpenGraph Pelayan Aktif</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Left: Live WhatsApp Link Preview Mockup */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-700">
            Pratonton Kad Pautan WhatsApp
          </p>
          <div className="rounded-xl bg-[#efeae2] p-4 border border-slate-200">
            <div className="ml-auto max-w-sm rounded-xl rounded-tr-xs bg-[#d9fdd3] p-2.5 shadow-xs">
              {/* WhatsApp Link Preview Box */}
              <div className="flex items-stretch gap-3 overflow-hidden rounded-lg bg-black/5 p-2">
                <img
                  src="/ss-homestay-icon-512.jpg"
                  alt="Logo SS Homestay & Roomstay"
                  className="h-16 w-16 rounded-md bg-white object-contain p-0.5 shrink-0 border border-slate-200"
                />
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <p className="truncate text-xs font-bold text-slate-900">
                    SS Homestay &amp; Roomstay — Kota Bharu, Kelantan
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
                    Penginapan selesa dengan Private Pool, 3 bilik tidur air-cond &amp; Roomstay di Kg Padang Enggang, Kota Bharu, Kelantan.
                  </p>
                  <p className="mt-1 truncate text-[10px] font-medium text-slate-500">
                    {displayDomain}
                  </p>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-800">
                {promoText.trim()}
              </p>
              <p className="mt-1 break-all text-xs font-medium text-[#027eb5] underline">
                {cleanShareUrl}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
            <p className="font-bold">Cara pastikan logo 100% keluar di WhatsApp:</p>
            <p>
              1. Klik butang <strong>Deploy</strong> (ikon roket) di AI Studio untuk dapatkan pautan awam <strong>Cloud Run (.run.app)</strong> (tetapkan capaian <em>Public</em>).
            </p>
            <p>
              2. Atau tekan butang <strong>Kongsi Logo + Pautan</strong> di sebelah pada telefon anda untuk menghantar gambar logo bersama pautan terus ke WhatsApp serta-merta.
            </p>
          </div>
        </div>

        {/* Right: Controls & Share Buttons */}
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="wa-share-url" className="text-xs font-semibold text-slate-700">
                Pautan Laman Web Untuk Dikongsi
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShareUrl(detectedOrigin)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  URL Semasa
                </button>
                <button
                  type="button"
                  onClick={() => setShareUrl(CONTACT_INFO.websiteUrl)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  URL ai.studio
                </button>
              </div>
            </div>
            <input
              id="wa-share-url"
              type="url"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <label htmlFor="wa-share-promo" className="block text-xs font-semibold text-slate-700">
              Keterangan Mesej Promosi WhatsApp
            </label>
            <textarea
              id="wa-share-promo"
              rows={4}
              value={promoText}
              onChange={(e) => setPromoText(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleNativeShareWithLogo}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              <span>Kongsi Logo + Pautan</span>
            </button>

            <a
              href={whatsappShareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Buka di WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>

            <button
              type="button"
              onClick={() => handleCopyText(fullWhatsAppMessage, 'full')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {copiedType === 'full' ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedType === 'full' ? 'Mesej Disalin!' : 'Salin Mesej + Pautan'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyFreshUrl}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-800 hover:bg-purple-100 transition-colors"
            >
              {copiedType === 'fresh' ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span>{copiedType === 'fresh' ? 'Pautan Baharu Disalin!' : 'Salin URL (Segar Cache)'}</span>
            </button>
          </div>

          {shareFeedback && (
            <p className="text-xs font-medium text-emerald-700" role="status">
              {shareFeedback}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
