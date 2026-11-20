import React, { useMemo } from 'react';
import { CONTACT_INFO, MONTH_NAMES } from '../data/homestayData';
import { FinancialRecord, SheetMeta, formatRM } from '../utils/sheetParser';

export type FinancialPrintMode = 'masuk' | 'keluar' | 'keseluruhan';

interface FinancialPrintReportProps {
  records: FinancialRecord[];
  printMode: FinancialPrintMode;
  periodKey: string; // 'semua' or 'YYYY-MM'
  sheetMeta: SheetMeta | null;
}

function formatMonthName(monthKey: string): string {
  if (monthKey === 'semua') return 'Keseluruhan (Semua Bulan)';
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const idx = Number(parts[1]) - 1;
  if (idx >= 0 && idx < MONTH_NAMES.length) {
    return `${MONTH_NAMES[idx]} ${parts[0]}`;
  }
  return monthKey;
}

export const FinancialPrintReport: React.FC<FinancialPrintReportProps> = ({
  records,
  printMode,
  periodKey,
  sheetMeta,
}) => {
  const todayFormatted = useMemo(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}/${now.getFullYear()}`;
  }, []);

  // Filter by period & printMode, strictly chronological for accounting accuracy
  const reportRows = useMemo(() => {
    const periodFiltered =
      periodKey === 'semua'
        ? records
        : records.filter((r) => r.monthKey === periodKey);

    const modeFiltered = periodFiltered.filter((r) => {
      if (printMode === 'masuk') return r.wangMasuk > 0;
      if (printMode === 'keluar') return r.wangKeluar > 0;
      return r.wangMasuk > 0 || r.wangKeluar > 0;
    });

    const chronological = [...modeFiltered].sort((a, b) => {
      if (a.tarikhIso !== b.tarikhIso) return a.tarikhIso.localeCompare(b.tarikhIso);
      return a.rowNumber - b.rowNumber;
    });

    let running = 0;
    return chronological.map((r) => {
      running += r.wangMasuk - r.wangKeluar;
      return { ...r, reportBaki: running };
    });
  }, [records, periodKey, printMode]);

  const totals = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let countMasuk = 0;
    let countKeluar = 0;
    reportRows.forEach((r) => {
      if (r.wangMasuk > 0) {
        masuk += r.wangMasuk;
        countMasuk += 1;
      }
      if (r.wangKeluar > 0) {
        keluar += r.wangKeluar;
        countKeluar += 1;
      }
    });
    const baki = masuk - keluar;
    const margin = masuk > 0 ? Math.round((baki / masuk) * 100) : 0;
    return { masuk, keluar, baki, countMasuk, countKeluar, margin };
  }, [reportRows]);

  // Monthly breakdown when printing Keseluruhan (All Months)
  const monthlySummary = useMemo(() => {
    if (periodKey !== 'semua') return [];
    const map = new Map<
      string,
      { monthKey: string; count: number; masuk: number; keluar: number; baki: number }
    >();
    reportRows.forEach((r) => {
      const key = r.monthKey || 'Lain-lain';
      const prev = map.get(key) || { monthKey: key, count: 0, masuk: 0, keluar: 0, baki: 0 };
      prev.count += 1;
      prev.masuk += r.wangMasuk;
      prev.keluar += r.wangKeluar;
      prev.baki = prev.masuk - prev.keluar;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [reportRows, periodKey]);

  const reportTitle =
    printMode === 'masuk'
      ? 'LAPORAN ANALISIS WANG MASUK'
      : printMode === 'keluar'
      ? 'LAPORAN ANALISIS WANG KELUAR'
      : 'LAPORAN ANALISIS KEWANGAN KESELURUHAN';

  return (
    <div className="bg-white text-slate-900">
      {/* Official Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-900">
            {CONTACT_INFO.brand.toUpperCase()}
          </h1>
          <p className="mt-1 text-xs text-slate-600">{CONTACT_INFO.address}</p>
          <p className="text-xs text-slate-600">
            Tel: {CONTACT_INFO.phoneDisplay} ({CONTACT_INFO.owner})
          </p>
        </div>

        <div className="sm:text-right">
          <p className="font-display text-sm font-bold text-slate-900">{reportTitle}</p>
          <p className="mt-1 text-xs text-slate-700">
            Tempoh: <strong>{formatMonthName(periodKey)}</strong>
          </p>
          <p className="text-xs text-slate-500 font-mono-num">
            Tarikh Cetakan: {todayFormatted}
            {sheetMeta?.tab ? ` · Sumber: ${sheetMeta.tab}` : ''}
          </p>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div
        className={`mt-5 grid gap-3 ${
          printMode === 'keseluruhan' ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        {(printMode === 'masuk' || printMode === 'keseluruhan') && (
          <div className="rounded-lg border border-slate-300 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">Jumlah Wang Masuk</p>
            <p className="mt-1 font-mono-num text-lg font-bold text-emerald-700">
              {formatRM(totals.masuk)}
            </p>
            <p className="text-[11px] text-slate-500 font-mono-num">
              {totals.countMasuk} transaksi
            </p>
          </div>
        )}

        {(printMode === 'keluar' || printMode === 'keseluruhan') && (
          <div className="rounded-lg border border-slate-300 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">Jumlah Wang Keluar</p>
            <p className="mt-1 font-mono-num text-lg font-bold text-rose-700">
              {formatRM(totals.keluar)}
            </p>
            <p className="text-[11px] text-slate-500 font-mono-num">
              {totals.countKeluar} transaksi
            </p>
          </div>
        )}

        {printMode === 'keseluruhan' && (
          <div className="rounded-lg border border-slate-900 bg-slate-50 p-3.5">
            <p className="text-[11px] font-semibold text-slate-600">Baki Bersih</p>
            <p
              className={`mt-1 font-mono-num text-lg font-extrabold ${
                totals.baki >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {formatRM(totals.baki)}
            </p>
            <p className="text-[11px] text-slate-600 font-mono-num">
              {totals.baki >= 0 ? 'Lebihan' : 'Defisit'} · Margin {totals.margin}%
            </p>
          </div>
        )}

        {printMode !== 'keseluruhan' && (
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-3.5">
            <p className="text-[11px] font-semibold text-slate-500">Skop Laporan</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatMonthName(periodKey)}
            </p>
            <p className="text-[11px] text-slate-500 font-mono-num">
              Jumlah rekod dipaparkan: {reportRows.length}
            </p>
          </div>
        )}
      </div>

      {/* Monthly Summary Table (when printing Keseluruhan / All Months) */}
      {periodKey === 'semua' && monthlySummary.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
            Ringkasan Mengikut Bulan
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-3 py-2 text-left">Bulan</th>
                <th className="border border-slate-300 px-3 py-2 text-center">Bil. Rekod</th>
                {(printMode === 'masuk' || printMode === 'keseluruhan') && (
                  <th className="border border-slate-300 px-3 py-2 text-right">Wang Masuk (RM)</th>
                )}
                {(printMode === 'keluar' || printMode === 'keseluruhan') && (
                  <th className="border border-slate-300 px-3 py-2 text-right">Wang Keluar (RM)</th>
                )}
                {printMode === 'keseluruhan' && (
                  <th className="border border-slate-300 px-3 py-2 text-right">Baki Bulanan (RM)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((m) => (
                <tr key={m.monthKey}>
                  <td className="border border-slate-300 px-3 py-1.5 font-medium text-slate-900">
                    {formatMonthName(m.monthKey)}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num text-slate-700">
                    {m.count}
                  </td>
                  {(printMode === 'masuk' || printMode === 'keseluruhan') && (
                    <td className="border border-slate-300 px-3 py-1.5 text-right font-mono-num text-emerald-700">
                      {formatRM(m.masuk)}
                    </td>
                  )}
                  {(printMode === 'keluar' || printMode === 'keseluruhan') && (
                    <td className="border border-slate-300 px-3 py-1.5 text-right font-mono-num text-rose-700">
                      {formatRM(m.keluar)}
                    </td>
                  )}
                  {printMode === 'keseluruhan' && (
                    <td
                      className={`border border-slate-300 px-3 py-1.5 text-right font-mono-num font-bold ${
                        m.baki >= 0 ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {formatRM(m.baki)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Chronological Transactions Table */}
      <div className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
          Senarai Rekod Terperinci ({reportRows.length} rekod)
        </h2>

        {reportRows.length === 0 ? (
          <div className="rounded-lg border border-slate-300 p-6 text-center text-xs text-slate-500">
            Tiada rekod transaksi bagi kategori dan tempoh yang dipilih.
          </div>
        ) : (
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-2 py-2 text-center w-10">Bil</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left whitespace-nowrap">
                  Tarikh
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">
                  {printMode === 'keluar' ? 'Perkara' : 'Perkara / Nama Tetamu'}
                </th>
                {printMode === 'masuk' && (
                  <th className="border border-slate-300 px-2.5 py-2 text-left whitespace-nowrap">
                    Unit
                  </th>
                )}
                {(printMode === 'masuk' || printMode === 'keseluruhan') && (
                  <th className="border border-slate-300 px-2.5 py-2 text-right whitespace-nowrap">
                    Wang Masuk (RM)
                  </th>
                )}
                {(printMode === 'keluar' || printMode === 'keseluruhan') && (
                  <th className="border border-slate-300 px-2.5 py-2 text-right whitespace-nowrap">
                    Wang Keluar (RM)
                  </th>
                )}
                {printMode === 'keseluruhan' && (
                  <th className="border border-slate-300 px-2.5 py-2 text-right whitespace-nowrap">
                    Baki (RM)
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {reportRows.map((rec, idx) => (
                <tr key={rec.id}>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-mono-num text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num whitespace-nowrap text-slate-700">
                    {rec.tarikhDisplay}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5 text-slate-900">
                    <span className="font-medium">{rec.perkara}</span>
                    {printMode !== 'keluar' && rec.nama && !rec.perkara.includes(rec.nama) && (
                      <span className="text-slate-600"> — {rec.nama}</span>
                    )}
                    {printMode === 'keseluruhan' && rec.unit && (
                      <span className="text-slate-500"> ({rec.unit})</span>
                    )}
                  </td>
                  {printMode === 'masuk' && (
                    <td className="border border-slate-300 px-2.5 py-1.5 whitespace-nowrap text-slate-700">
                      {rec.unit || '-'}
                    </td>
                  )}
                  {(printMode === 'masuk' || printMode === 'keseluruhan') && (
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right font-mono-num text-emerald-700 whitespace-nowrap">
                      {rec.wangMasuk > 0 ? formatRM(rec.wangMasuk) : '—'}
                    </td>
                  )}
                  {(printMode === 'keluar' || printMode === 'keseluruhan') && (
                    <td className="border border-slate-300 px-2.5 py-1.5 text-right font-mono-num text-rose-700 whitespace-nowrap">
                      {rec.wangKeluar > 0 ? formatRM(rec.wangKeluar) : '—'}
                    </td>
                  )}
                  {printMode === 'keseluruhan' && (
                    <td
                      className={`border border-slate-300 px-2.5 py-1.5 text-right font-mono-num font-bold whitespace-nowrap ${
                        rec.reportBaki >= 0 ? 'text-slate-900' : 'text-rose-700'
                      }`}
                    >
                      {formatRM(rec.reportBaki)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <td
                  colSpan={printMode === 'masuk' ? 4 : 3}
                  className="border border-slate-300 px-2.5 py-2 text-right"
                >
                  JUMLAH{' '}
                  {printMode === 'masuk'
                    ? 'WANG MASUK'
                    : printMode === 'keluar'
                    ? 'WANG KELUAR'
                    : 'KESELURUHAN'}
                </td>
                {(printMode === 'masuk' || printMode === 'keseluruhan') && (
                  <td className="border border-slate-300 px-2.5 py-2 text-right font-mono-num text-emerald-700 whitespace-nowrap">
                    {formatRM(totals.masuk)}
                  </td>
                )}
                {(printMode === 'keluar' || printMode === 'keseluruhan') && (
                  <td className="border border-slate-300 px-2.5 py-2 text-right font-mono-num text-rose-700 whitespace-nowrap">
                    {formatRM(totals.keluar)}
                  </td>
                )}
                {printMode === 'keseluruhan' && (
                  <td
                    className={`border border-slate-300 px-2.5 py-2 text-right font-mono-num whitespace-nowrap ${
                      totals.baki >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatRM(totals.baki)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Signature / Footer */}
      <div className="mt-10 grid grid-cols-2 gap-8 pt-6 text-xs text-slate-600">
        <div>
          <p>Disediakan oleh:</p>
          <div className="mt-10 border-b border-slate-400 w-48" />
          <p className="mt-1 font-semibold text-slate-800">Admin {CONTACT_INFO.brand}</p>
          <p className="font-mono-num text-[11px]">Tarikh: {todayFormatted}</p>
        </div>
        <div>
          <p>Disahkan oleh:</p>
          <div className="mt-10 border-b border-slate-400 w-48" />
          <p className="mt-1 font-semibold text-slate-800">{CONTACT_INFO.owner}</p>
          <p className="text-[11px]">Pemilik {CONTACT_INFO.brand}</p>
        </div>
      </div>
    </div>
  );
};
