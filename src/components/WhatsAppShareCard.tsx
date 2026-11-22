import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  MessageCircle,
  RotateCcw,
  Save,
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

const WA_SHARE_URL_STORAGE_KEY = 'ss_homestay_wa_share_url_v1';
const WA_PROMO_TEXT_STORAGE_KEY = 'ss_homestay_wa_promo_text_v1';

const DEFAULT_PROMO_TEXT =
  'Jemput menginap di *SS Homestay & Roomstay*, Kg Padang Enggang, Kota Bharu, Kelantan!\n• Homestay + Private Pool + 3 Bilik Air-Cond\n• Roomstay + Private Pool + 1 Bilik Aircond\n• Pakej Kombo Homestay & Roomstay\nDiskaun Harga Yang Melebihi 2 Malam\n\nSemak tarikh kosong & tempah terus di sini:';

function readStoredValue(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored && stored.trim().length > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}

export const WhatsAppShareCard: React.FC = () => {
  const detectedOrigin = useMemo(() => {
    if (typeof window === 'undefined') return CONTACT_INFO.websiteUrl;
    return window.location.origin;
  }, []);

  const initialShareUrl = useMemo(
    () => readStoredValue(WA_SHARE_URL_STORAGE_KEY, detectedOrigin),
    [detectedOrigin]
  );
  const initialPromoText = useMemo(
    () => readStoredValue(WA_PROMO_TEXT_STORAGE_KEY, DEFAULT_PROMO_TEXT),
    []
  );

  const [shareUrl, setShareUrl] = useState<string>(initialShareUrl);
  const [promoText, setPromoText] = useState<string>(initialPromoText);
  const [savedUrl, setSavedUrl] = useState<string>(initialShareUrl);
  const [savedPromoText, setSavedPromoText] = useState<string>(initialPromoText);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'url' | 'fresh' | 'full' | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [ogStatus, setOgStatus] = useState<OgCheckData | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

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

  const hasUnsavedChanges = shareUrl !== savedUrl || promoText !== savedPromoText;

  const showTempSaveFeedback = (message: string) => {
    setSaveFeedback(message);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => setSaveFeedback(null), 3200);
  };

  const handleSaveSettings = () => {
    const nextUrl = shareUrl.trim() || detectedOrigin;
    const nextPromo = promoText.trim() || DEFAULT_PROMO_TEXT;

    try {
      window.localStorage.setItem(WA_SHARE_URL_STORAGE_KEY, nextUrl);
      window.localStorage.setItem(WA_PROMO_TEXT_STORAGE_KEY, nextPromo);
    } catch {
      showTempSaveFeedback('Tidak dapat menyimpan ke pelayar. Sila cuba lagi.');
      return;
    }

    setShareUrl(nextUrl);
    setPromoText(nextPromo);
    setSavedUrl(nextUrl);
    setSavedPromoText(nextPromo);
    showTempSaveFeedback('Pautan & mesej promosi berjaya disimpan.');
  };

  const handleResetDefaults = () => {
    try {
      window.localStorage.removeItem(WA_SHARE_URL_STORAGE_KEY);
      window.localStorage.removeItem(WA_PROMO_TEXT_STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }

    setShareUrl(detectedOrigin);
    setPromoText(DEFAULT_PROMO_TEXT);
    setSavedUrl(detectedOrigin);
    setSavedPromoText(DEFAULT_PROMO_TEXT);
    showTempSaveFeedback('Tetapan dikembalikan kepada pautan & mesej asal.');
  };

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
        const res = await fetch('/ss-homestay-logo-v5.jpg');
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
                  src="/ss-homestay-logo-v5.jpg"
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
            <p className="font-bold">Cara hantar gambar logo bersama pautan:</p>
            <p>
              1. Pastikan URL di atas ialah URL laman awam yang boleh dibuka oleh pelanggan, kemudian tekan <strong>Simpan Tetapan</strong>.
            </p>
            <p>
              2. Pada telefon, tekan <strong>Kongsi Logo + Pautan</strong> dan pilih WhatsApp. Gambar promosi akan dihantar bersama mesej dan URL yang boleh ditekan.
            </p>
            <p>
              Jika hanya mahu kad pratonton pautan, gunakan <strong>Buka di WhatsApp</strong> dan tampal mesej itu dalam chat.
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
              type="text"
              inputMode="url"
              spellCheck={false}
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-num text-xs sm:text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="wa-share-promo" className="block text-xs font-semibold text-slate-700">
                Keterangan Mesej Promosi WhatsApp
              </label>
              <span
                className={`text-[11px] font-medium ${
                  hasUnsavedChanges ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {hasUnsavedChanges ? 'Perubahan belum disimpan' : 'Disimpan'}
              </span>
            </div>
            <textarea
              id="wa-share-promo"
              rows={6}
              spellCheck={false}
              value={promoText}
              onChange={(e) => setPromoText(e.target.value)}
              placeholder="Tulis mesej promosi WhatsApp di sini..."
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm leading-relaxed text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Save className="h-3.5 w-3.5 shrink-0" />
              <span>Simpan Tetapan</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Set Semula Asal</span>
            </button>

            {saveFeedback && (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
                role="status"
              >
                <Check className="h-3.5 w-3.5 shrink-0" />
                {saveFeedback}
              </span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 pt-1 border-t border-slate-100">
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
