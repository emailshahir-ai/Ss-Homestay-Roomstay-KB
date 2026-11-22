import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Printer,
  Star,
} from 'lucide-react';
import {
  CONTACT_INFO,
  HOMESTAY_FACILITIES,
  HOMESTAY_PHOTOS,
  HOMESTAY_RATES,
  HOUSE_RULES,
  ROOMSTAY_FEATURES,
  ROOMSTAY_PHOTOS,
  ROOMSTAY_RATES,
  TABS,
  TESTIMONIAL_PHOTOS,
  TabId,
  YOUTUBE_VIDEOS,
} from './data/homestayData';
import { BookingCalendar, BookingRecord } from './components/BookingCalendar';
import { AdminPanel } from './components/AdminPanel';
import { Lightbox, LightboxImage } from './components/Lightbox';
import { SafeImage } from './components/SafeImage';
import { WhatsAppBookingForm } from './components/WhatsAppBookingForm';
import { GuestReceiptGenerator } from './components/GuestReceiptGenerator';
import {
  FinancialRecord,
  SheetMeta,
  SheetRowRecord,
  parseSheetResponse,
} from './utils/sheetParser';
import { getActiveScriptUrl } from './utils/sheetApi';
import { formatDisplayPhone } from './utils/whatsapp';

interface FeedbackEntry {
  id: string;
  date: string;
  rating: number;
  note?: string;
}

const FEEDBACK_STORAGE_KEY = 'ss_homestay_feedback_v1';
const OWNER_PHONE_STORAGE_KEY = 'ss_homestay_owner_whatsapp_v1';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('utama');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [sheetRows, setSheetRows] = useState<SheetRowRecord[]>([]);
  const [sheetMeta, setSheetMeta] = useState<SheetMeta | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [prefilledCheckIn, setPrefilledCheckIn] = useState<string | null>(null);
  const [savedOwnerPhone, setSavedOwnerPhone] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(OWNER_PHONE_STORAGE_KEY);
      return stored || CONTACT_INFO.phoneRaw;
    } catch {
      return CONTACT_INFO.phoneRaw;
    }
  });

  // Guest rating state
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string>('');
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>(() => {
    try {
      const saved = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as FeedbackEntry[]) : [];
    } catch {
      return [];
    }
  });

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Copy address state
  const [copiedAddress, setCopiedAddress] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadCalendarData = useCallback(async (notify = false): Promise<FinancialRecord[] | null> => {
    setLoadingCalendar(true);
    setCalendarError(null);
    if (notify) {
      showToast('Data kalendar dan kewangan sedang dikemaskini...');
    }

    try {
      const activeUrl = getActiveScriptUrl();
      const cacheBuster = `${activeUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(`${activeUrl}${cacheBuster}`, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
      });

      if (!res.ok) {
        throw new Error('Ralat capaian pelayan tempahan.');
      }

      const data = await res.json();
      const parsed = parseSheetResponse(data);
      setBookings(parsed.bookings);
      setFinancialRecords(parsed.financialRecords);
      setSheetRows(parsed.sheetRows);
      setSheetMeta(parsed.meta);
      if (notify) {
        showToast('Data kalendar dan kewangan berjaya dikemaskini.');
      }
      return parsed.financialRecords;
    } catch (err) {
      console.error(err);
      setCalendarError(
        'Gagal memuat turun data daripada Google Sheet. Sila semak sambungan internet anda dan cuba muat semula.'
      );
      return null;
    } finally {
      setLoadingCalendar(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadCalendarData(false);
  }, [loadCalendarData]);

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRating) {
      showToast('Sila pilih skala penilaian 1 hingga 5 terlebih dahulu.');
      return;
    }

    const newEntry: FeedbackEntry = {
      id: `${Date.now()}`,
      date: new Date().toLocaleDateString('ms-MY'),
      rating: selectedRating,
      note: feedbackNote.trim() || undefined,
    };

    const updated = [newEntry, ...feedbackList];
    setFeedbackList(updated);
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }

    setSelectedRating(null);
    setFeedbackNote('');
    showToast('Terima kasih atas penilaian anda!');
  };

  const openLightbox = (images: LightboxImage[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_INFO.address);
      setCopiedAddress(true);
      showToast('Alamat telah disalin.');
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      showToast('Tidak dapat menyalin alamat secara automatik.');
    }
  };

  const handleUpdateSavedOwnerPhone = useCallback(
    (phoneNormalized: string) => {
      setSavedOwnerPhone(phoneNormalized);
      try {
        localStorage.setItem(OWNER_PHONE_STORAGE_KEY, phoneNormalized);
      } catch {
        // ignore storage error
      }
      showToast('Nombor telefon WhatsApp tempahan telah dikemaskini.');
    },
    [showToast]
  );

  const handleSelectDateForBooking = useCallback((dateIso: string) => {
    setPrefilledCheckIn(dateIso);
    const el = document.getElementById('borang-whatsapp-tempahan');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const displayOwnerPhone = formatDisplayPhone(savedOwnerPhone) || CONTACT_INFO.phoneDisplay;

  const whatsappUrl = `https://wa.me/${savedOwnerPhone}?text=${encodeURIComponent(
    'Assalamualaikum Pn. Hajjah Sarina, saya berminat untuk bertanya tentang kekosongan SS Homestay & Roomstay.'
  )}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 sm:gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('utama')}
            className="font-display text-sm min-[380px]:text-base sm:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            SS Homestay &amp; Roomstay
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {(
              [
                { id: 'utama', label: 'Utama' },
                { id: 'pengenalan', label: 'Pengenalan' },
                { id: 'roomstay', label: 'Roomstay' },
                { id: 'foto', label: 'Foto' },
                { id: 'lokasi', label: 'Lokasi' },
              ] as { id: TabId; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                  activeTab === item.id
                    ? 'border-emerald-600 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Website Globe icon + primary action */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={CONTACT_INFO.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buka Laman Web Rasmi SS Homestay & Roomstay"
              title="Laman Web Rasmi SS Homestay & Roomstay"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-700 shadow-xs transition-all hover:border-purple-700 hover:bg-purple-700 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-purple-600 shrink-0"
            >
              <Globe className="h-4.5 w-4.5" aria-hidden="true" />
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-emerald-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Hubungi Kami</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-5 sm:py-7">
        {/* Official Banner Photo at Top of Main View */}
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white no-print">
          <button
            type="button"
            onClick={() =>
              openLightbox(
                [
                  {
                    src: '/assets/aistudio/header_a3bc0ce2.jpg',
                    alt: 'SS Homestay & Roomstay — Kampung Padang Enggang, Kota Bharu, Kelantan',
                  },
                ],
                0
              )
            }
            className="block w-full focus-visible:outline-2 focus-visible:outline-emerald-600"
            aria-label="Besarkan banner SS Homestay & Roomstay"
          >
            <SafeImage
              src="/assets/aistudio/header_a3bc0ce2.jpg"
              alt="SS Homestay & Roomstay — Kampung Padang Enggang, Kota Bharu, Kelantan"
              className="block w-full h-auto object-contain"
            />
          </button>

          {/* Tulisan Berjalan Dari Kanan Ke Kiri Di Bawah Foto Header */}
          <div
            className="marquee-wrapper overflow-hidden border-t border-purple-800/30 bg-purple-700 py-1.5 leading-none text-white"
            aria-label="Selamat Datang Ke Portal Ss Homestay & Roomstay Kota Bharu | Semoga Percutian Anda Lebih Bermakna Semasa Menginap Di Homestay & Roomstay Kami | Insya-Allah Selamat Dan Selesa Sepanjang Masa | Terima Kasih Kerana Memilih Ss Homestay & Roomstay |"
          >
            <span className="animate-marquee-rtl font-display text-[11px] sm:text-xs font-bold tracking-wider">
              Selamat Datang Ke Portal Ss Homestay &amp; Roomstay Kota Bharu &nbsp;&nbsp;|&nbsp;&nbsp; Semoga Percutian Anda Lebih Bermakna Semasa Menginap Di Homestay &amp; Roomstay Kami &nbsp;&nbsp;|&nbsp;&nbsp; Insya-Allah Selamat Dan Selesa Sepanjang Masa &nbsp;&nbsp;|&nbsp;&nbsp; Terima Kasih Kerana Memilih Ss Homestay &amp; Roomstay &nbsp;&nbsp;|
            </span>
          </div>
        </section>

        {/* Compact Hero Summary */}
        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5 no-print">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Kg Padang Enggang, Kota Bharu, Kelantan · Private Pool · 3 Bilik Air-Cond
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 [text-wrap:balance]">
              Penginapan Selesa &amp; Mesra Keluarga
            </h1>
          </div>
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{CONTACT_INFO.owner}</span>
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            <a
              href={`tel:${savedOwnerPhone}`}
              className="font-mono-num font-semibold text-emerald-700 hover:underline"
            >
              {displayOwnerPhone}
            </a>
          </div>
        </section>

        {/* Full 11-Tab Navigation Grid: 3 rows on narrow phones, 2 rows on wider phones/tablets, 1 row on desktop */}
        <div
          className="mb-6 grid grid-cols-4 min-[520px]:grid-cols-6 lg:flex lg:flex-wrap lg:items-center gap-1.5 sm:gap-2 no-print"
          role="tablist"
          aria-label="Menu utama SS Homestay & Roomstay"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[38px] sm:min-h-[40px] px-2 sm:px-3.5 py-2 text-[11px] sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap truncate text-center ${
                  tab.isAdmin
                    ? isActive
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    : isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: UTAMA (Kalendar + Borang WhatsApp Tempahan + Penilaian) */}
        {activeTab === 'utama' && (
          <div className="space-y-8">
            <BookingCalendar
              bookings={bookings}
              loading={loadingCalendar}
              error={calendarError}
              onRefresh={() => loadCalendarData(true)}
              onSelectDateForBooking={handleSelectDateForBooking}
            />

            <WhatsAppBookingForm
              savedOwnerPhone={savedOwnerPhone}
              prefilledCheckIn={prefilledCheckIn}
              bookings={bookings}
            />

            {/* Penilaian Tetamu */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="max-w-xl">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Penilaian Tetamu
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Kongsi pengalaman penginapan anda di SS Homestay &amp; Roomstay.
                </p>

                <form onSubmit={handleSubmitRating} className="mt-5 space-y-4">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const active = selectedRating !== null && value <= selectedRating;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedRating(value)}
                          className={`flex h-11 w-11 flex-col items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                            active
                              ? 'border-amber-400 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                          aria-label={`Beri ${value} bintang`}
                        >
                          <Star
                            className={`h-4 w-4 ${active ? 'fill-amber-400 text-amber-500' : ''}`}
                          />
                          <span className="font-mono-num text-[10px] mt-0.5">{value}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label htmlFor="feedback-note" className="sr-only">
                      Ulasan ringkas (pilihan)
                    </label>
                    <input
                      id="feedback-note"
                      type="text"
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      placeholder="Tulis ulasan ringkas anda (pilihan)..."
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>

                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    Hantar Penilaian
                  </button>
                </form>

                {feedbackList.length > 0 && (
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-bold text-slate-900">Maklum Balas Terkini</h3>
                    <div className="mt-3 divide-y divide-slate-100">
                      {feedbackList.map((item) => (
                        <div key={item.id} className="py-2.5 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-mono-num font-medium text-slate-700">
                              {item.date}
                            </span>
                            <span className="font-mono-num font-semibold text-amber-600">
                              {'★'.repeat(item.rating)}
                              {'☆'.repeat(5 - item.rating)} ({item.rating}/5)
                            </span>
                          </div>
                          {item.note && <p className="text-sm text-slate-700">{item.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: PENGENALAN */}
        {activeTab === 'pengenalan' && (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Pengenalan SS Homestay
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
                Nikmati penginapan yang selesa, tenang dan mesra keluarga di homestay kami.
                Terletak di lokasi strategik di Kota Bharu, sesuai untuk percutian keluarga,
                urusan kerja atau majlis kenduri.
              </p>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 border-t border-slate-200 pt-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">Alamat Rasmi</h3>
                  <p className="mt-1 text-sm font-medium text-slate-900">{CONTACT_INFO.address}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">Suasana &amp; Keselamatan</h3>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    InsyaAllah selamat, tenang, dengan ruang parking luas untuk 8 hingga 10 biji kereta.
                  </p>
                </div>
              </div>
            </section>

            {/* Kadar Harga Homestay */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900">Kadar Harga Homestay</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {HOMESTAY_RATES.map((rate) => (
                  <div
                    key={rate.label}
                    className={`rounded-lg border p-5 ${
                      rate.featured
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{rate.label}</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-mono-num text-2xl font-bold text-slate-900">
                        {rate.price}
                      </span>
                      <span className="text-xs text-slate-500">{rate.unit}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{rate.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 pt-5">
                <p className="text-sm text-slate-700">
                  Untuk tempahan atau pertanyaan lanjut, hubungi{' '}
                  <strong className="text-slate-900">
                    {CONTACT_INFO.phoneDisplay} ({CONTACT_INFO.owner})
                  </strong>
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Phone className="h-4 w-4" />
                  <span>WhatsApp Sekarang</span>
                </a>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: INFO / KEISTIMEWAAN */}
        {activeTab === 'keistimewaan' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Keistimewaan &amp; Kemudahan Kami
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Lengkap dengan kolam renang persendirian dan kelengkapan rumah untuk keselesaan seisi keluarga.
            </p>

            <div className="mt-6 grid gap-8 lg:grid-cols-5 items-start">
              <ul className="lg:col-span-3 grid gap-3 sm:grid-cols-2">
                {HOMESTAY_FACILITIES.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-sm text-slate-800"
                  >
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="lg:col-span-2 overflow-hidden rounded-lg border border-slate-200">
                <SafeImage
                  src="https://sksi4com.wordpress.com/wp-content/uploads/2026/04/image_9a22e31f.jpg"
                  alt="Pemandangan SS Homestay"
                  className="w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() =>
                    openLightbox(
                      [
                        {
                          src: 'https://sksi4com.wordpress.com/wp-content/uploads/2026/04/image_9a22e31f.jpg',
                          alt: 'Pemandangan SS Homestay',
                        },
                      ],
                      0
                    )
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ROOMSTAY */}
        {activeTab === 'roomstay' && (
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">SS Roomstay</h2>
              <p className="mt-2 max-w-3xl text-base text-slate-600">
                SS Roomstay menawarkan bilik persinggahan yang sangat selesa, bersih dan berpatutan
                untuk pasangan atau tetamu yang memerlukan penginapan ringkas.
              </p>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Keistimewaan Roomstay</h3>
                  <ul className="mt-3 space-y-2.5">
                    {ROOMSTAY_FEATURES.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">Kadar Harga Roomstay</h3>
                  <div className="mt-3 space-y-2.5">
                    {ROOMSTAY_RATES.map((rate) => (
                      <div
                        key={rate.label}
                        className={`flex items-center justify-between rounded-lg border p-3.5 ${
                          rate.featured
                            ? 'border-emerald-300 bg-emerald-50/50'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{rate.label}</p>
                          <p className="text-xs text-slate-500">{rate.note}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono-num text-base font-bold text-slate-900">
                            {rate.price}
                          </span>
                          <span className="block text-[11px] text-slate-500">{rate.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900">Galeri Roomstay</h3>
              <p className="mt-1 text-sm text-slate-500">Klik mana-mana gambar untuk paparan penuh.</p>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ROOMSTAY_PHOTOS.map((photo, idx) => (
                  <button
                    key={photo.src}
                    type="button"
                    onClick={() => openLightbox(ROOMSTAY_PHOTOS, idx)}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-4/3 focus-visible:outline-2 focus-visible:outline-emerald-600"
                  >
                    <SafeImage
                      src={photo.src}
                      alt={photo.alt}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: FOTO */}
        {activeTab === 'foto' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Galeri Foto Homestay
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Klik gambar untuk melihat paparan penuh ({HOMESTAY_PHOTOS.length} gambar).
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {HOMESTAY_PHOTOS.map((photo, idx) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => openLightbox(HOMESTAY_PHOTOS, idx)}
                  className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-4/3 focus-visible:outline-2 focus-visible:outline-emerald-600"
                >
                  <SafeImage
                    src={photo.src}
                    alt={photo.alt}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* TAB 6: VIDEO */}
        {activeTab === 'video' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Galeri Video Homestay
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tonton paparan video sebenar suasana dan kemudahan SS Homestay.
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {YOUTUBE_VIDEOS.map((video) => {
                const isLandscape = video.orientation === 'landscape';
                const portraitCount = YOUTUBE_VIDEOS.filter(
                  (v) => v.orientation === 'portrait'
                ).length;
                const isSoloPortrait = !isLandscape && portraitCount === 1;
                return (
                  <div
                    key={video.id}
                    className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${
                      isLandscape
                        ? 'md:col-span-2'
                        : isSoloPortrait
                          ? 'md:col-span-2 mx-auto w-full max-w-[360px]'
                          : ''
                    }`}
                  >
                    <div
                      className={
                        isLandscape
                          ? 'aspect-video w-full bg-slate-900'
                          : isSoloPortrait
                            ? 'aspect-9/16 w-full bg-slate-900'
                            : 'aspect-9/16 max-h-[520px] w-full bg-slate-900'
                      }
                    >
                      <iframe
                        src={video.embedUrl}
                        title={video.title}
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-4 bg-white border-t border-slate-200">
                      <span className="text-sm font-semibold text-slate-900">{video.title}</span>
                      <a
                        href={video.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
                      >
                        <span>YouTube</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 7: RESPONS / TESTIMONI */}
        {activeTab === 'respon' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Respons &amp; Testimoni Tetamu
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Maklum balas sebenar daripada para tetamu yang pernah menginap di SS Homestay &amp; Roomstay. Klik untuk besarkan.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TESTIMONIAL_PHOTOS.map((photo, idx) => (
                <button
                  key={photo.src}
                  type="button"
                  onClick={() => openLightbox(TESTIMONIAL_PHOTOS, idx)}
                  className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-3/4 focus-visible:outline-2 focus-visible:outline-emerald-600"
                >
                  <SafeImage
                    src={photo.src}
                    alt={photo.alt}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* TAB 8: LOKASI */}
        {activeTab === 'lokasi' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Peta Lokasi</h2>
                <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{CONTACT_INFO.address}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedAddress ? 'Disalin' : 'Salin Alamat'}</span>
                </button>
                <a
                  href={CONTACT_INFO.mapsDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Buka di Google Maps</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <iframe
                src={CONTACT_INFO.mapsEmbedUrl}
                title="Peta Lokasi SS Homestay"
                className="h-[460px] w-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        )}

        {/* TAB 9: CETAKAN */}
        {activeTab === 'cetakan' && (
          <div className="space-y-6">
            <GuestReceiptGenerator />

            <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 print:hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Borang Cetakan Tempahan
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Sila isi borang di bawah untuk tujuan rekod atau cetakan rasmi tempahan anda.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <a
                    href={CONTACT_INFO.printFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Buka Paparan Penuh</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Cetak Halaman</span>
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <iframe
                  src={CONTACT_INFO.printFormEmbedUrl}
                  title="Borang Cetakan Tempahan"
                  className="h-[780px] w-full border-0"
                >
                  Memuatkan borang...
                </iframe>
              </div>
            </section>
          </div>
        )}

        {/* TAB 10: PERATURAN */}
        {activeTab === 'peraturan' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Peraturan Homestay
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Kerjasama semua tetamu amat dihargai demi keselesaan bersama.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {HOUSE_RULES.map((rule, idx) => (
                <div
                  key={rule.title}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                >
                  <p className="font-mono-num text-xs font-semibold text-slate-400">
                    0{idx + 1}.
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">{rule.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{rule.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 11: ADMIN */}
        {activeTab === 'admin' && (
          <AdminPanel
            bookings={bookings}
            financialRecords={financialRecords}
            sheetRows={sheetRows}
            sheetMeta={sheetMeta}
            loadingData={loadingCalendar}
            dataError={calendarError}
            savedOwnerPhone={savedOwnerPhone}
            onUpdateSavedOwnerPhone={handleUpdateSavedOwnerPhone}
            onRefreshCalendar={() => loadCalendarData(true)}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white no-print">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-6 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-800">{CONTACT_INFO.brand}</span>
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            <span>{CONTACT_INFO.address}</span>
          </div>
          <div>
            <span>Hubungi: </span>
            <a
              href={`tel:${CONTACT_INFO.phoneRaw}`}
              className="font-mono-num font-semibold text-slate-800 hover:underline"
            >
              {CONTACT_INFO.phoneDisplay}
            </a>
            <span> ({CONTACT_INFO.owner})</span>
          </div>
        </div>
      </footer>

      {/* Lightbox Modal */}
      <Lightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(idx) => setLightboxIndex(idx)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg no-print"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
