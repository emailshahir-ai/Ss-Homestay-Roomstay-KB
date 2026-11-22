import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Eraser,
  FileDown,
  Loader2,
  PenTool,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { CONTACT_INFO } from '../data/homestayData';
import { SheetRowRecord, formatRM } from '../utils/sheetParser';
import {
  RECEIPT_LOGO_PATH,
  RECEIPT_SIGNATORY_NAME,
  RECEIPT_SIGNATORY_ROLE,
  calculateNights,
  formatIsoToDmy,
  generateGuestReceiptPdf,
} from '../utils/guestReceiptPdf';

interface GuestReceiptGeneratorProps {
  sheetRows?: SheetRowRecord[];
  initialRow?: SheetRowRecord | null;
  onClearInitialRow?: () => void;
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function generateDefaultRefNo(seedNum?: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix =
    seedNum !== undefined
      ? String(seedNum).padStart(3, '0')
      : String(Math.floor(100 + Math.random() * 900));
  return `SSH-${y}${m}${d}-${suffix}`;
}

function parseAmountInput(raw: string): number {
  const cleaned = raw.replace(/RM/gi, '').replace(/\s+/g, '').replace(/,/g, '.');
  const val = Number.parseFloat(cleaned);
  return Number.isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : 0;
}

export const GuestReceiptGenerator: React.FC<GuestReceiptGeneratorProps> = ({
  sheetRows = [],
  initialRow = null,
  onClearInitialRow,
}) => {
  const [noRujukan, setNoRujukan] = useState<string>(() => generateDefaultRefNo());
  const [tarikhIso, setTarikhIso] = useState<string>(() => getTodayIso());
  const [nama, setNama] = useState<string>('');
  const [noKadPengenalan, setNoKadPengenalan] = useState<string>('');
  const [tarikhMasukIso, setTarikhMasukIso] = useState<string>('');
  const [tarikhKeluarIso, setTarikhKeluarIso] = useState<string>('');
  const [jumlahStr, setJumlahStr] = useState<string>('');
  const [pilihanPenginapan, setPilihanPenginapan] = useState<string>('Ss Homestay');
  const [catatan, setCatatan] = useState<string>('');
  const [selectedSheetRowId, setSelectedSheetRowId] = useState<string>('');

  // Optional digital signature canvas state
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bookingRows = useMemo(
    () =>
      [...sheetRows]
        .filter((r) => r.nama.trim().length > 0)
        .sort((a, b) => b.rowNumber - a.rowNumber),
    [sheetRows]
  );

  const applySheetRow = (row: SheetRowRecord) => {
    setNoRujukan(generateDefaultRefNo(row.rowNumber));
    setTarikhIso(getTodayIso());
    setNama(row.nama);
    setTarikhMasukIso(row.tarikhMasukIso);
    setTarikhKeluarIso(row.tarikhKeluarIso);
    setJumlahStr(row.jumlah > 0 ? String(row.jumlah) : '');
    if (row.pilihanLabel) {
      setPilihanPenginapan(row.pilihanLabel);
    }
    setCatatan(row.perkara || '');
    setSelectedSheetRowId(row.id);
    setErrorMsg(null);
  };

  useEffect(() => {
    if (initialRow) {
      applySheetRow(initialRow);
      onClearInitialRow?.();
    }
  }, [initialRow, onClearInitialRow]);

  const jumlahNumber = useMemo(() => parseAmountInput(jumlahStr), [jumlahStr]);
  const nights = useMemo(
    () => calculateNights(tarikhMasukIso, tarikhKeluarIso),
    [tarikhMasukIso, tarikhKeluarIso]
  );

  // Signature canvas pointer helpers
  const getCanvasCoords = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoords(e);
    isDrawingRef.current = true;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureDataUrl(null);
  };

  const handleResetForm = () => {
    setNoRujukan(generateDefaultRefNo());
    setTarikhIso(getTodayIso());
    setNama('');
    setNoKadPengenalan('');
    setTarikhMasukIso('');
    setTarikhKeluarIso('');
    setJumlahStr('');
    setPilihanPenginapan('Ss Homestay');
    setCatatan('');
    setSelectedSheetRowId('');
    setErrorMsg(null);
  };

  const validateBeforeOutput = (): boolean => {
    if (!noRujukan.trim()) {
      setErrorMsg('Sila masukkan No. Rujukan resit.');
      return false;
    }
    if (!tarikhIso) {
      setErrorMsg('Sila pilih Tarikh resit.');
      return false;
    }
    if (!nama.trim()) {
      setErrorMsg('Sila masukkan Nama penuh penghuni.');
      return false;
    }
    if (!noKadPengenalan.trim()) {
      setErrorMsg('Sila masukkan No. Kad Pengenalan penghuni.');
      return false;
    }
    if (!tarikhMasukIso || !tarikhKeluarIso) {
      setErrorMsg('Sila pilih Tarikh Masuk dan Tarikh Keluar.');
      return false;
    }
    if (tarikhKeluarIso < tarikhMasukIso) {
      setErrorMsg('Tarikh Keluar tidak boleh lebih awal daripada Tarikh Masuk.');
      return false;
    }
    if (jumlahNumber <= 0) {
      setErrorMsg('Sila masukkan Jumlah bayaran (RM) yang sah.');
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleDownloadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBeforeOutput()) return;
    setGenerating(true);
    try {
      await generateGuestReceiptPdf({
        noRujukan,
        tarikhIso,
        nama,
        noKadPengenalan,
        tarikhMasukIso,
        tarikhKeluarIso,
        jumlah: jumlahNumber,
        pilihanPenginapan,
        catatan,
        signatureDataUrl,
      });
    } catch (err) {
      console.error('Gagal menjana PDF resit penghuni:', err);
      setErrorMsg('Gagal menjana fail PDF. Sila cuba semula.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDirectPrint = () => {
    if (!validateBeforeOutput()) return;
    window.print();
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-12 print:hidden">
        {/* Left: Borang Resit Penghuni */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-700 text-white">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  Borang PDF Cetakan Resit Penghuni
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Lengkapkan maklumat di bawah untuk menjana dan memuat turun resit rasmi PDF A4
                  berserta logo Ss Homestay.
                </p>
              </div>
            </div>
          </div>

          {/* Optional Auto-Fill from Google Sheet (Admin mode) */}
          {bookingRows.length > 0 && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5">
              <label
                htmlFor="receipt-sheet-picker"
                className="block text-xs font-bold text-emerald-900"
              >
                Isi Pantas daripada Rekod Google Sheet (Pilihan)
              </label>
              <select
                id="receipt-sheet-picker"
                value={selectedSheetRowId}
                onChange={(e) => {
                  const found = bookingRows.find((r) => r.id === e.target.value);
                  if (found) applySheetRow(found);
                }}
                className="mt-1.5 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="">-- Pilih rekod tempahan tetamu untuk auto-isi --</option>
                {bookingRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.rowNumber} · {row.nama}
                    {row.tarikhMasukDisplay ? ` (${row.tarikhMasukDisplay})` : ''}
                    {row.jumlah > 0 ? ` — ${formatRM(row.jumlah)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleDownloadPdf} className="mt-5 space-y-4">
            {/* No. Rujukan & Tarikh */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="resit-rujukan"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    No. Rujukan <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNoRujukan(generateDefaultRefNo())}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Jana Baru</span>
                  </button>
                </div>
                <input
                  id="resit-rujukan"
                  type="text"
                  required
                  value={noRujukan}
                  onChange={(e) => setNoRujukan(e.target.value)}
                  placeholder="Contoh: SSH-20261121-001"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm font-semibold text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="resit-tarikh"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tarikh <span className="text-rose-600">*</span>
                </label>
                <input
                  id="resit-tarikh"
                  type="date"
                  required
                  value={tarikhIso}
                  onChange={(e) => setTarikhIso(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>
            </div>

            {/* Nama Penghuni */}
            <div>
              <label htmlFor="resit-nama" className="block text-xs font-semibold text-slate-700">
                Nama <span className="text-rose-600">*</span>
              </label>
              <input
                id="resit-nama"
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Muhammad Amirul bin Azman"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
              />
            </div>

            {/* No. Kad Pengenalan & Pilihan Penginapan */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="resit-ic" className="block text-xs font-semibold text-slate-700">
                  No. Kad Pengenalan <span className="text-rose-600">*</span>
                </label>
                <input
                  id="resit-ic"
                  type="text"
                  required
                  value={noKadPengenalan}
                  onChange={(e) => setNoKadPengenalan(e.target.value)}
                  placeholder="Contoh: 900101-03-5123"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>

              <div>
                <label htmlFor="resit-unit" className="block text-xs font-semibold text-slate-700">
                  Pilihan Penginapan (Pilihan)
                </label>
                <select
                  id="resit-unit"
                  value={pilihanPenginapan}
                  onChange={(e) => setPilihanPenginapan(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                >
                  <option value="Ss Homestay">Ss Homestay</option>
                  <option value="Ss Roomstay">Ss Roomstay</option>
                  <option value="Ss Homestay & Roomstay (Kombo)">
                    Ss Homestay &amp; Roomstay (Kombo)
                  </option>
                  <option value="">Tidak dinyatakan</option>
                </select>
              </div>
            </div>

            {/* Tarikh Masuk & Tarikh Keluar */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="resit-masuk"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tarikh Masuk <span className="text-rose-600">*</span>
                </label>
                <input
                  id="resit-masuk"
                  type="date"
                  required
                  value={tarikhMasukIso}
                  onChange={(e) => setTarikhMasukIso(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="resit-keluar"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tarikh Keluar <span className="text-rose-600">*</span>{' '}
                  {nights > 0 && (
                    <span className="font-mono-num text-emerald-700">({nights} malam)</span>
                  )}
                </label>
                <input
                  id="resit-keluar"
                  type="date"
                  required
                  min={tarikhMasukIso || undefined}
                  value={tarikhKeluarIso}
                  onChange={(e) => setTarikhKeluarIso(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>
            </div>

            {/* Jumlah & Catatan */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="resit-jumlah"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Jumlah (RM) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="resit-jumlah"
                  type="text"
                  inputMode="decimal"
                  required
                  value={jumlahStr}
                  onChange={(e) => setJumlahStr(e.target.value)}
                  placeholder="Contoh: 300 atau 600.00"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-num text-sm font-bold text-emerald-800 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="resit-catatan"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Catatan Ringkas (Pilihan)
                </label>
                <input
                  id="resit-catatan"
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Bayaran Penuh / Tunai / QR"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
              </div>
            </div>

            {/* Tandatangan Pengurus (Optional Digital Sign Pad) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Tandatangan: {RECEIPT_SIGNATORY_NAME}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {RECEIPT_SIGNATORY_ROLE} — Boleh tandatangan digital di sini atau biarkan kosong
                    untuk tandatangan bertulis selepas dicetak.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSignaturePad((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  <span>{showSignaturePad ? 'Sembunyi Pad' : 'Tandatangan Digital'}</span>
                </button>
              </div>

              {showSignaturePad && (
                <div className="mt-3 space-y-2">
                  <canvas
                    ref={canvasRef}
                    width={420}
                    height={130}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className="w-full h-32 rounded-lg border border-dashed border-slate-400 bg-white touch-none cursor-crosshair"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Lakar tandatangan menggunakan tetikus atau jari di kotak atas.</span>
                    <button
                      type="button"
                      onClick={handleClearSignature}
                      className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline"
                    >
                      <Eraser className="h-3 w-3" />
                      <span>Padam</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleResetForm}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Kosongkan</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Resit</span>
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menjana PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" />
                      <span>Muat Turun PDF Resit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Right: Pratonton Resit Rasmi Langsung */}
        <section className="lg:col-span-6">
          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 sm:p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              Pratonton Resit Rasmi (A4)
            </p>
            <ReceiptPreviewSheet
              noRujukan={noRujukan}
              tarikhIso={tarikhIso}
              nama={nama}
              noKadPengenalan={noKadPengenalan}
              tarikhMasukIso={tarikhMasukIso}
              tarikhKeluarIso={tarikhKeluarIso}
              jumlah={jumlahNumber}
              pilihanPenginapan={pilihanPenginapan}
              catatan={catatan}
              nights={nights}
              signatureDataUrl={signatureDataUrl}
            />
          </div>
        </section>
      </div>

      {/* Print-Only Full A4 Receipt Sheet */}
      <div className="hidden print:block">
        <ReceiptPreviewSheet
          noRujukan={noRujukan}
          tarikhIso={tarikhIso}
          nama={nama}
          noKadPengenalan={noKadPengenalan}
          tarikhMasukIso={tarikhMasukIso}
          tarikhKeluarIso={tarikhKeluarIso}
          jumlah={jumlahNumber}
          pilihanPenginapan={pilihanPenginapan}
          catatan={catatan}
          nights={nights}
          signatureDataUrl={signatureDataUrl}
          isPrintSheet
        />
      </div>
    </>
  );
};

interface ReceiptPreviewSheetProps {
  noRujukan: string;
  tarikhIso: string;
  nama: string;
  noKadPengenalan: string;
  tarikhMasukIso: string;
  tarikhKeluarIso: string;
  jumlah: number;
  pilihanPenginapan: string;
  catatan: string;
  nights: number;
  signatureDataUrl: string | null;
  isPrintSheet?: boolean;
}

const ReceiptPreviewSheet: React.FC<ReceiptPreviewSheetProps> = ({
  noRujukan,
  tarikhIso,
  nama,
  noKadPengenalan,
  tarikhMasukIso,
  tarikhKeluarIso,
  jumlah,
  pilihanPenginapan,
  catatan,
  nights,
  signatureDataUrl,
  isPrintSheet = false,
}) => {
  return (
    <div
      className={`overflow-hidden rounded-lg bg-white text-slate-900 ${
        isPrintSheet ? 'border-0 p-2' : 'border border-slate-200 shadow-sm'
      }`}
    >
      <div className="p-5 sm:p-7 space-y-5">
        {/* Colored Top Header Box (Petak Berwarna Ungu Rasmi) */}
        <div className="rounded-xl border border-purple-900 bg-purple-800 px-5 py-5 text-center text-white shadow-xs">
          <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-xl border border-purple-200 bg-white px-3 py-2 shadow-xs">
            <img
              src={RECEIPT_LOGO_PATH}
              alt="Logo Ss Homestay & Roomstay"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h4 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white">
            SS HOMESTAY &amp; ROOMSTAY
          </h4>
          <p className="mt-1 text-[11px] sm:text-xs text-purple-100">{CONTACT_INFO.address}</p>
          <p className="text-[11px] sm:text-xs text-purple-200 font-mono-num">
            Tel: {CONTACT_INFO.phoneDisplay} / 016-986 3776 · Kota Bharu, Kelantan
          </p>
          <div className="mx-auto mt-3.5 h-1 w-3/4 rounded-full bg-purple-500/80" />
        </div>

        {/* Document Title */}
        <div className="rounded-md border border-purple-200 bg-purple-50 py-2 text-center">
          <p className="font-display text-sm sm:text-base font-extrabold tracking-wider text-purple-900">
            RESIT RASMI PENGHUNI
          </p>
        </div>

        {/* No. Rujukan & Tarikh */}
        <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-md border border-slate-200 bg-white">
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              No. Rujukan
            </p>
            <p className="mt-0.5 font-mono-num text-xs sm:text-sm font-bold text-slate-900 break-all">
              {noRujukan.trim() || '—'}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tarikh</p>
            <p className="mt-0.5 font-mono-num text-xs sm:text-sm font-bold text-slate-900">
              {formatIsoToDmy(tarikhIso)}
            </p>
          </div>
        </div>

        {/* Butiran Penghuni & Penginapan */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-purple-800">
            Butiran Penghuni &amp; Penginapan
          </p>
          <div className="overflow-hidden rounded-md border border-slate-200 divide-y divide-slate-200 text-xs sm:text-sm">
            <div className="grid grid-cols-12 bg-slate-50/70">
              <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                Nama Penghuni
              </div>
              <div className="col-span-7 px-3 py-2.5 font-bold text-slate-900">
                {nama.trim() || '—'}
              </div>
            </div>

            <div className="grid grid-cols-12 bg-white">
              <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                No. Kad Pengenalan
              </div>
              <div className="col-span-7 px-3 py-2.5 font-mono-num font-bold text-slate-900">
                {noKadPengenalan.trim() || '—'}
              </div>
            </div>

            {pilihanPenginapan.trim() && (
              <div className="grid grid-cols-12 bg-slate-50/70">
                <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                  Pilihan Penginapan
                </div>
                <div className="col-span-7 px-3 py-2.5 font-semibold text-slate-900">
                  {pilihanPenginapan}
                </div>
              </div>
            )}

            <div className="grid grid-cols-12 bg-white">
              <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                Tarikh Masuk
              </div>
              <div className="col-span-7 px-3 py-2.5 font-mono-num font-bold text-slate-900">
                {tarikhMasukIso ? `${formatIsoToDmy(tarikhMasukIso)} (3:00 Petang)` : '—'}
              </div>
            </div>

            <div className="grid grid-cols-12 bg-slate-50/70">
              <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                Tarikh Keluar
              </div>
              <div className="col-span-7 px-3 py-2.5 font-mono-num font-bold text-slate-900">
                {tarikhKeluarIso ? `${formatIsoToDmy(tarikhKeluarIso)} (12:00 Tgh hari)` : '—'}
              </div>
            </div>

            {nights > 0 && (
              <div className="grid grid-cols-12 bg-white">
                <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                  Tempoh Menginap
                </div>
                <div className="col-span-7 px-3 py-2.5 font-mono-num font-bold text-slate-900">
                  {nights} Malam
                </div>
              </div>
            )}

            {catatan.trim() && (
              <div className="grid grid-cols-12 bg-slate-50/70">
                <div className="col-span-5 border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-600">
                  Catatan / Perkara
                </div>
                <div className="col-span-7 px-3 py-2.5 font-medium text-slate-800">{catatan}</div>
              </div>
            )}
          </div>
        </div>

        {/* Jumlah Bayaran */}
        <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-emerald-600 bg-emerald-50/80 px-4 py-3.5">
          <div>
            <p className="text-xs font-extrabold tracking-wide text-emerald-900">
              JUMLAH BAYARAN DITERIMA
            </p>
            <p className="text-[11px] text-emerald-700">Status: Diterima &amp; Disahkan</p>
          </div>
          <p className="font-mono-num text-xl sm:text-2xl font-extrabold text-emerald-700 whitespace-nowrap">
            {formatRM(jumlah)}
          </p>
        </div>

        {/* Tandatangan Pengurus */}
        <div className="flex justify-end pt-4">
          <div className="w-64 text-left">
            <p className="text-xs text-slate-600">Dikeluarkan &amp; Disahkan oleh,</p>
            <div className="mt-2 flex h-16 items-end pb-1">
              {signatureDataUrl ? (
                <img
                  src={signatureDataUrl}
                  alt={`Tandatangan ${RECEIPT_SIGNATORY_NAME}`}
                  className="max-h-14 w-auto object-contain"
                />
              ) : (
                <div className="h-14" />
              )}
            </div>
            <div className="border-t border-slate-500 pt-2">
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                {RECEIPT_SIGNATORY_NAME}
              </p>
              <p className="text-xs text-slate-600">{RECEIPT_SIGNATORY_ROLE}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
          Terima kasih kerana memilih Ss Homestay &amp; Roomstay · Kota Bharu, Kelantan
        </div>
      </div>
    </div>
  );
};
