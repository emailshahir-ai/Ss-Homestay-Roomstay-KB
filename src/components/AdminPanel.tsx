import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarPlus,
  Check,
  ClipboardList,
  Download,
  ExternalLink,
  Lock,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { CONTACT_INFO } from '../data/homestayData';
import { FinancialRecord, SheetMeta, formatRM } from '../utils/sheetParser';
import { BookingRecord } from './BookingCalendar';
import { FinancialAnalytics } from './FinancialAnalytics';
import { AdminBookingForm } from './AdminBookingForm';
import { WhatsAppBookingForm } from './WhatsAppBookingForm';
import { WhatsAppShareCard } from './WhatsAppShareCard';
import {
  buildAdminConfirmationMessage,
  buildWhatsAppUrl,
  formatDisplayPhone,
  normalizeMalaysiaPhone,
} from '../utils/whatsapp';

interface AdminPanelProps {
  bookings: BookingRecord[];
  financialRecords: FinancialRecord[];
  sheetMeta: SheetMeta | null;
  loadingData: boolean;
  dataError: string | null;
  savedOwnerPhone: string;
  onUpdateSavedOwnerPhone: (phone: string) => void;
  onRefreshCalendar: () => Promise<FinancialRecord[] | null> | void;
}

type AdminSubTab = 'tempahan' | 'kewangan' | 'whatsapp' | 'pengurusan';

function formatIsoDisplay(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  bookings,
  financialRecords,
  sheetMeta,
  loadingData,
  dataError,
  savedOwnerPhone,
  onUpdateSavedOwnerPhone,
  onRefreshCalendar,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [subTab, setSubTab] = useState<AdminSubTab>('tempahan');

  // Owner saved WhatsApp phone editor
  const [phoneInput, setPhoneInput] = useState<string>(() => formatDisplayPhone(savedOwnerPhone) || CONTACT_INFO.phoneDisplay);
  const [phoneSavedMsg, setPhoneSavedMsg] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Guest booking search in WhatsApp tab
  const [guestSearch, setGuestSearch] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '677397' || password === '123456') {
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Kata laluan tidak sah. Sila cuba lagi.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setErrorMsg('');
  };

  const handleSaveOwnerPhone = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeMalaysiaPhone(phoneInput);
    if (!normalized) {
      setPhoneError('Sila masukkan nombor telefon Malaysia yang sah (contoh: 016-986 7367).');
      setPhoneSavedMsg(null);
      return;
    }
    setPhoneError(null);
    onUpdateSavedOwnerPhone(normalized);
    setPhoneInput(formatDisplayPhone(normalized));
    setPhoneSavedMsg('Nombor telefon WhatsApp tempahan berjaya disimpan.');
    setTimeout(() => setPhoneSavedMsg(null), 3000);
  };

  const handleDownloadSquareIcon = (format: 'png' | 'jpeg') => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `logo-ss-homestay-512x512.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        mime,
        0.95
      );
    };
    img.src = `/ss-homestay-icon-512.png?v=${Date.now()}`;
  };

  const sortedBookings = useMemo(() => {
    const q = guestSearch.trim().toLowerCase();
    return [...bookings]
      .sort((a, b) => b.masuk.localeCompare(a.masuk))
      .filter((b) => {
        if (!q) return true;
        const hay = `${b.nama} ${b.noTelefon || ''} ${b.pilihan || ''} ${b.masuk} ${b.keluar}`.toLowerCase();
        return hay.includes(q);
      });
  }, [bookings, guestSearch]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Pengesahan Admin</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sila masukkan kata laluan pentadbir untuk mengakses analisis kewangan, WhatsApp tempahan dan papan pemuka pengurusan.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-pass" className="block text-sm font-medium text-slate-700">
              Kata Laluan
            </label>
            <input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Masukkan kata laluan"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              autoComplete="current-password"
            />
          </div>

          {errorMsg && (
            <p className="text-sm font-medium text-rose-600" role="alert">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Sahkan Akses
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Authenticated Admin Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 no-print">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Papan Pemuka Admin</h2>
            <p className="text-sm text-slate-600">
              Urus analisis kewangan, WhatsApp tempahan tetamu, serta rekod Google Sheet.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-white border border-slate-200 p-1">
            <button
              type="button"
              onClick={() => setSubTab('tempahan')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'tempahan'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Buat Tempahan</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('kewangan')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'kewangan'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Analisis Kewangan</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('whatsapp')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'whatsapp'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp Tempahan</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('pengurusan')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'pengurusan'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>AppSheet &amp; Borang</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Log Keluar</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 0: Admin Booking Form */}
      {subTab === 'tempahan' && (
        <AdminBookingForm
          bookings={bookings}
          sheetMeta={sheetMeta}
          onRefresh={onRefreshCalendar}
        />
      )}

      {/* Sub-tab 1: Financial Analytics + Finance Entry Form */}
      {subTab === 'kewangan' && (
        <FinancialAnalytics
          records={financialRecords}
          meta={sheetMeta}
          loading={loadingData}
          error={dataError}
          onRefresh={onRefreshCalendar}
        />
      )}

      {/* Sub-tab 2: WhatsApp Tempahan (Saved Owner Phone + Direct WhatsApp to Saved Guest Numbers) */}
      {subTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Owner Saved Phone Number Configuration */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Nombor Telefon Penerima WhatsApp Tempahan (Disimpan)
              </h3>
              <p className="text-xs text-slate-500">
                Nombor telefon WhatsApp yang disimpan ini digunakan sebagai penerima mesej bagi Borang Tempahan WhatsApp Admin dan butang hubungi utama.
              </p>
            </div>

            <form onSubmit={handleSaveOwnerPhone} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 max-w-sm">
                <label htmlFor="saved-owner-phone" className="block text-xs font-semibold text-slate-700">
                  No. Telefon WhatsApp Homestay
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="saved-owner-phone"
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="Contoh: 0169867367"
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 font-mono-num text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Check className="h-4 w-4" />
                <span>Simpan Nombor</span>
              </button>
            </form>

            {phoneError && (
              <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
                {phoneError}
              </p>
            )}
            {phoneSavedMsg && (
              <p className="mt-2 text-xs font-medium text-emerald-700" role="status">
                {phoneSavedMsg}
              </p>
            )}
          </section>

          {/* Admin-only WhatsApp Booking Form */}
          <WhatsAppBookingForm savedOwnerPhone={savedOwnerPhone} bookings={bookings} />

          {/* Guest Bookings List with Direct WhatsApp to Saved Phone Numbers */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  WhatsApp Pengesahan Terus Kepada Tetamu (Google Sheet)
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Klik butang WhatsApp untuk menghantar slip pengesahan tempahan terus ke nombor telefon tetamu yang disimpan dalam rekod Google Sheet.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    placeholder="Cari nama atau telefon..."
                    className="w-48 sm:w-56 rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={onRefreshCalendar}
                  disabled={loadingData}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                  <span>Segar</span>
                </button>
              </div>
            </div>

            {sortedBookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Tiada rekod tempahan ditemui.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 pl-5 pr-3">Nama Tetamu</th>
                      <th className="py-3 px-3 whitespace-nowrap">No. Telefon Disimpan</th>
                      <th className="py-3 px-3 whitespace-nowrap">Unit</th>
                      <th className="py-3 px-3 whitespace-nowrap">Tarikh Menginap</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Jumlah (RM)</th>
                      <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {sortedBookings.map((b, idx) => {
                      const validPhone = normalizeMalaysiaPhone(b.noTelefon);
                      const waHref = validPhone
                        ? buildWhatsAppUrl(
                            validPhone,
                            buildAdminConfirmationMessage({
                              nama: b.nama,
                              unit: b.pilihan,
                              tarikhMasuk: b.masuk,
                              tarikhKeluar: b.keluar,
                              jumlah: b.jumlah,
                            })
                          )
                        : '';

                      return (
                        <tr key={`${b.nama}-${b.masuk}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pl-5 pr-3 font-medium text-slate-900">
                            {b.nama}
                          </td>
                          <td className="py-3 px-3 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                            {validPhone ? (
                              formatDisplayPhone(b.noTelefon)
                            ) : (
                              <span className="text-slate-400">
                                {b.noTelefon ? `${b.noTelefon} (Tidak sah)` : 'Tiada nombor'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-700 whitespace-nowrap">
                            {b.pilihan || 'Penginapan'}
                          </td>
                          <td className="py-3 px-3 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                            {formatIsoDisplay(b.masuk)} → {formatIsoDisplay(b.keluar)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-xs font-semibold text-slate-900 whitespace-nowrap">
                            {b.jumlah && b.jumlah > 0 ? formatRM(b.jumlah) : '—'}
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>Hantar WhatsApp</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Tiada no. sah</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Sub-tab 3: AppSheet, Linktree & Google Form */}
      {subTab === 'pengurusan' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Sistem Pengurusan AppSheet</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Buka aplikasi pengurusan homestay sepenuhnya untuk menyemak dan mengurus rekod tetamu.
                </p>
              </div>
              <a
                href={CONTACT_INFO.appsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <span>Buka Aplikasi AppSheet</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pautan Pengurusan (Linktree)</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Capaian pantas ke semua pautan rasmi dan pengurusan terdahulu SS Homestay.
                </p>
              </div>
              <a
                href={CONTACT_INFO.linktreeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <span>Buka Linktree Pengurusan</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* 1:1 Square App Icon Download Card */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/ss-homestay-icon-512.png"
                alt="Ikon Segi Empat Sama SS Homestay (512x512)"
                className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-1 shrink-0"
              />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Logo Ikon Aplikasi Segi Empat Sama (512×512)
                </h3>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                  Dijana terus sebagai fail imej tulen <span className="font-mono-num font-semibold text-slate-800">512×512 (1:1)</span> dalam format <strong>PNG</strong> atau <strong>JPG</strong> untuk dimuat naik ke ruangan <strong>Icon</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadSquareIcon('png')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-purple-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>Muat Turun PNG (512×512)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadSquareIcon('jpeg')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-purple-800 hover:bg-purple-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>Muat Turun JPG (512×512)</span>
              </button>
            </div>
          </div>

          {/* WhatsApp Link Preview & Logo+Link Share Helper */}
          <WhatsAppShareCard />

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Borang Pengisian Tempahan Tetamu</h3>
                <p className="text-sm text-slate-600">
                  Selepas menghantar borang, klik butang kemaskini untuk menyegerakkan kalendar dan rekod kewangan.
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshCalendar}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Kemaskini Data</span>
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <iframe
                src={CONTACT_INFO.adminBookingFormEmbedUrl}
                title="Borang Pengisian Tempahan Tetamu"
                className="h-[780px] w-full border-0"
              >
                Memuatkan borang...
              </iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
