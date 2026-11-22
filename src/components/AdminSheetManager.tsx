import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Database,
  Link2,
  Pencil,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { SheetMeta, SheetRowRecord, formatRM } from '../utils/sheetParser';
import {
  GOOGLE_APPS_SCRIPT_V10_CODE,
  getActiveScriptUrl,
  hasCustomScriptUrl,
  resetCustomScriptUrl,
  saveCustomScriptUrl,
} from '../utils/sheetApi';
import { formatDisplayPhone, normalizeMalaysiaPhone } from '../utils/whatsapp';

interface AdminSheetManagerProps {
  sheetRows: SheetRowRecord[];
  sheetMeta: SheetMeta | null;
  loading: boolean;
  error: string | null;
  forceShowScriptGuide: boolean;
  onDismissScriptGuideForce: () => void;
  onEditRow: (row: SheetRowRecord) => void;
  onDeleteRow: (row: SheetRowRecord) => void;
  onCreateReceipt?: (row: SheetRowRecord) => void;
  onRefresh: () => Promise<unknown> | void;
}

type RowFilter = 'semua' | 'tempahan' | 'masuk' | 'keluar';

export const AdminSheetManager: React.FC<AdminSheetManagerProps> = ({
  sheetRows,
  sheetMeta,
  loading,
  error,
  forceShowScriptGuide,
  onDismissScriptGuideForce,
  onEditRow,
  onDeleteRow,
  onCreateReceipt,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RowFilter>('semua');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Apps Script v10 guide & custom URL config
  const [showGuide, setShowGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [scriptUrlInput, setScriptUrlInput] = useState(() => getActiveScriptUrl());
  const [scriptUrlFeedback, setScriptUrlFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isGuideExpanded = showGuide || forceShowScriptGuide;

  const isV10Ready =
    (sheetMeta?.scriptVersion !== undefined && sheetMeta.scriptVersion >= 10) ||
    Boolean(
      sheetMeta?.capabilities?.includes('update') &&
        sheetMeta?.capabilities?.includes('delete')
    );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = sheetRows.filter((row) => {
      if (categoryFilter === 'tempahan' && row.kategori !== 'tempahan') return false;
      if (categoryFilter === 'masuk' && row.jumlah <= 0) return false;
      if (categoryFilter === 'keluar' && row.wangKeluar <= 0) return false;

      if (q) {
        const hay =
          `#${row.rowNumber} ${row.nama} ${row.noTelefon} ${row.pilihanLabel} ${row.pilihanCode} ${row.tarikhMasukDisplay} ${row.tarikhKeluarDisplay} ${row.perkara} ${row.timestamp}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) =>
      sortOrder === 'desc' ? b.rowNumber - a.rowNumber : a.rowNumber - b.rowNumber
    );
  }, [sheetRows, searchQuery, categoryFilter, sortOrder]);

  const counts = useMemo(() => {
    let tempahan = 0;
    let masuk = 0;
    let keluar = 0;
    sheetRows.forEach((r) => {
      if (r.kategori === 'tempahan') tempahan += 1;
      if (r.jumlah > 0) masuk += 1;
      if (r.wangKeluar > 0) keluar += 1;
    });
    return { total: sheetRows.length, tempahan, masuk, keluar };
  }, [sheetRows]);

  const handleCopyScriptCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_V10_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleSaveScriptUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setScriptUrlFeedback(null);
    const res = saveCustomScriptUrl(scriptUrlInput);
    if (!res.ok) {
      setScriptUrlFeedback({ type: 'error', text: res.error || 'URL tidak sah.' });
      return;
    }
    setScriptUrlInput(getActiveScriptUrl());
    setScriptUrlFeedback({
      type: 'success',
      text: 'URL Apps Script disimpan. Menyegerakkan data daripada Google Sheet...',
    });
    await onRefresh();
  };

  const handleResetScriptUrl = async () => {
    resetCustomScriptUrl();
    setScriptUrlInput(getActiveScriptUrl());
    setScriptUrlFeedback({
      type: 'success',
      text: 'URL Apps Script ditetapkan semula ke lalai.',
    });
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Top Status & Controls Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                Urus Data Google Sheet (Edit &amp; Padam)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                <span>{sheetMeta?.title || 'Google Sheet Tempahan'}</span>
                {sheetMeta?.tab && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>Tab: {sheetMeta.tab}</span>
                  </>
                )}
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono-num">{counts.total} baris data</span>
                {sheetMeta?.lastSyncedAt && (
                  <>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span className="font-mono-num">Disegerak {sheetMeta.lastSyncedAt}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (forceShowScriptGuide) {
                  onDismissScriptGuideForce();
                  setShowGuide(false);
                } else {
                  setShowGuide((prev) => !prev);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isV10Ready
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>
                {isV10Ready ? 'Tetapan Skrip (v10)' : 'Kemaskini Skrip v10'}
              </span>
              {isGuideExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Memuat...' : 'Segar Semula'}</span>
            </button>
          </div>
        </div>

        {/* Script Version Status Banner */}
        {isV10Ready ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>
              <strong>Apps Script v{sheetMeta?.scriptVersion ?? 10} Aktif</strong> — Fungsi Edit
              dan Padam terus ke Google Sheet sedia digunakan.
            </span>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">
                  Skrip Google Sheet semasa: v{sheetMeta?.scriptVersion ?? 'lama'} — Perlu v10 untuk
                  Edit &amp; Padam terus
                </p>
                <p className="mt-0.5 text-amber-900">
                  Klik <strong>Kemaskini Skrip v10</strong> untuk salin kod baharu (1 minit) supaya
                  Google Sheet menerima arahan Edit &amp; Padam secara selamat.
                </p>
              </div>
            </div>
            {!isGuideExpanded && (
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="self-start sm:self-auto rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap shrink-0"
              >
                Lihat Kod v10
              </button>
            )}
          </div>
        )}

        {/* Collapsible Apps Script v10 Setup & Custom URL Panel */}
        {isGuideExpanded && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Panduan &amp; Kod Google Apps Script v10 (Edit &amp; Padam)
                </h4>
                <p className="text-xs text-slate-600">
                  Kod ini menyokong <strong>Baca</strong>, <strong>Tambah (append)</strong>,{' '}
                  <strong>Edit (update)</strong>, dan <strong>Padam (delete)</strong> dengan kunci
                  keselamatan baris.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyScriptCode}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Kod Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Kod Apps Script v10</span>
                  </>
                )}
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 bg-white rounded-lg border border-slate-200 p-3.5">
              <li>
                Buka Google Sheet anda (<strong>{sheetMeta?.title || 'SISTEM BOOKING AI STUDIO'}</strong>)
                → klik menu <strong>Extensions → Apps Script</strong>.
              </li>
              <li>
                Padam kod lama dalam fail <strong>Code.gs</strong>, tampal kod v10 di bawah dan klik{' '}
                <strong>Save (Ctrl+S)</strong>.
              </li>
              <li>
                Klik <strong>Deploy → Manage deployments → Edit (ikon pensel) → Version: New version → Deploy</strong>{' '}
                (URL Web App kekal sama, tidak perlu tukar URL).
              </li>
              <li>
                Kembali ke sini dan klik <strong>Segar Semula</strong> — status akan bertukar hijau ke{' '}
                <strong>Apps Script v10 Aktif</strong>.
              </li>
            </ol>

            <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100">
              <code>{GOOGLE_APPS_SCRIPT_V10_CODE}</code>
            </pre>

            {/* Optional Custom Web App URL override */}
            <form
              onSubmit={handleSaveScriptUrl}
              className="border-t border-slate-200 pt-4 space-y-2.5"
            >
              <label
                htmlFor="custom-script-url"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"
              >
                <Link2 className="h-3.5 w-3.5 text-slate-500" />
                <span>URL Web App Google Apps Script (Pilihan jika buat New Deployment)</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="custom-script-url"
                  type="url"
                  value={scriptUrlInput}
                  onChange={(e) => setScriptUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-num text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Simpan &amp; Segerak
                </button>
                {hasCustomScriptUrl() && (
                  <button
                    type="button"
                    onClick={handleResetScriptUrl}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Lalai</span>
                  </button>
                )}
              </div>
              {scriptUrlFeedback && (
                <p
                  className={`text-xs font-medium ${
                    scriptUrlFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {scriptUrlFeedback.text}
                </p>
              )}
            </form>
          </div>
        )}
      </section>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Search, Filter & Sheet Rows Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'semua', label: `Semua (${counts.total})` },
                { id: 'tempahan', label: `Tempahan (${counts.tempahan})` },
                { id: 'masuk', label: `Wang Masuk (${counts.masuk})` },
                { id: 'keluar', label: `Wang Keluar (${counts.keluar})` },
              ] as { id: RowFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, telefon, perkara, #baris..."
                className="w-full sm:w-64 rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {sortOrder === 'desc' ? 'Baris Terkini Dahulu' : 'Baris Awal Dahulu'}
            </button>
          </div>
        </div>

        {loading && sheetRows.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-12 w-full animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">Tiada rekod Google Sheet ditemui</p>
            <p className="mt-1 text-xs text-slate-500">
              Cuba laraskan kata kunci carian atau penapis kategori di atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 pl-4 sm:pl-5 pr-2 whitespace-nowrap">Baris</th>
                  <th className="py-3 px-3">Tetamu / Perkara</th>
                  <th className="py-3 px-3 whitespace-nowrap">Unit &amp; Tarikh</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Wang Masuk</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Wang Keluar</th>
                  <th className="py-3 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRows.map((row) => {
                  const validPhone = normalizeMalaysiaPhone(row.noTelefon);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-4 sm:pl-5 pr-2 align-top whitespace-nowrap">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono-num text-xs font-bold text-slate-700">
                          #{row.rowNumber}
                        </span>
                      </td>

                      <td className="py-3 px-3 align-top min-w-[200px]">
                        <p className="font-semibold text-slate-900 leading-snug">
                          {row.nama || row.perkara || '(Tiada tajuk)'}
                        </p>
                        {row.nama && row.perkara && (
                          <p className="mt-0.5 text-xs text-slate-600">{row.perkara}</p>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                          {row.noTelefon && (
                            <span className="font-mono-num">
                              {validPhone ? formatDisplayPhone(row.noTelefon) : row.noTelefon}
                            </span>
                          )}
                          {row.timestamp && (
                            <span className="font-mono-num text-slate-400">{row.timestamp}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        {row.pilihanLabel && (
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                            {row.pilihanLabel}
                          </span>
                        )}
                        {(row.tarikhMasukDisplay || row.tarikhKeluarDisplay) && (
                          <p className="mt-1 font-mono-num text-xs text-slate-600">
                            {row.tarikhMasukDisplay || '—'}
                            {row.tarikhKeluarDisplay ? ` → ${row.tarikhKeluarDisplay}` : ''}
                          </p>
                        )}
                        {!row.pilihanLabel && !row.tarikhMasukDisplay && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 align-top text-right font-mono-num text-xs font-semibold text-emerald-700 whitespace-nowrap">
                        {row.jumlah > 0 ? formatRM(row.jumlah) : '—'}
                      </td>

                      <td className="py-3 px-3 align-top text-right font-mono-num text-xs font-semibold text-rose-700 whitespace-nowrap">
                        {row.wangKeluar > 0 ? formatRM(row.wangKeluar) : '—'}
                      </td>

                      <td className="py-3 pl-3 pr-4 sm:pr-5 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {onCreateReceipt && row.nama && (
                            <button
                              type="button"
                              onClick={() => onCreateReceipt(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                              title={`Jana PDF Resit Penghuni untuk ${row.nama}`}
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              <span>Resit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditRow(row)}
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                            title={`Edit Baris #${row.rowNumber}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRow(row)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                            title={`Padam Baris #${row.rowNumber}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Padam</span>
                          </button>
                        </div>
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
  );
};
