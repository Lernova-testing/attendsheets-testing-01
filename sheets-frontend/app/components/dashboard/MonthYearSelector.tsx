import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthRange {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

interface MonthYearSelectorProps {
  currentMonth: number;
  currentYear: number;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onRangeChange: (range: MonthRange) => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const toMonthIndex = (month: number, year: number) => year * 12 + month;

export const MonthYearSelector: React.FC<MonthYearSelectorProps> = ({
  currentMonth,
  currentYear,
  startMonth,
  startYear,
  endMonth,
  endYear,
  onMonthChange,
  onYearChange,
  onRangeChange,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [yearInput, setYearInput] = useState(currentYear.toString());
  const [activeTab, setActiveTab] = useState<'single' | 'range'>('single');
  const [rangeStartMonth, setRangeStartMonth] = useState(startMonth);
  const [rangeStartYear, setRangeStartYear] = useState(startYear.toString());
  const [rangeEndMonth, setRangeEndMonth] = useState(endMonth);
  const [rangeEndYear, setRangeEndYear] = useState(endYear.toString());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setYearInput(currentYear.toString());
  }, [currentYear]);

  useEffect(() => {
    setRangeStartMonth(startMonth);
    setRangeStartYear(startYear.toString());
    setRangeEndMonth(endMonth);
    setRangeEndYear(endYear.toString());
  }, [startMonth, startYear, endMonth, endYear, showPicker]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  const handleYearInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setYearInput(numericValue);
  };

  const handleYearSubmit = () => {
    const year = parseInt(yearInput, 10);
    if (!isNaN(year) && year >= 1900 && year <= 9999) {
      onYearChange(year);
    } else {
      setYearInput(currentYear.toString());
    }
  };

  const handleYearKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleYearSubmit();
    } else if (e.key === 'Escape') {
      setYearInput(currentYear.toString());
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      if (currentMonth === 11) {
        onMonthChange(0);
        onYearChange(currentYear + 1);
      } else {
        onMonthChange(currentMonth + 1);
      }
    } else {
      if (currentMonth === 0) {
        onMonthChange(11);
        onYearChange(currentYear - 1);
      } else {
        onMonthChange(currentMonth - 1);
      }
    }
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    const newYear = direction === 'next' ? currentYear + 1 : currentYear - 1;
    if (newYear >= 1900 && newYear <= 9999) {
      onYearChange(newYear);
      setYearInput(newYear.toString());
    }
  };

  const isRangeValid = (): boolean => {
    const startY = parseInt(rangeStartYear, 10);
    const endY = parseInt(rangeEndYear, 10);
    if (Number.isNaN(startY) || Number.isNaN(endY)) return false;
    if (startY < 1900 || startY > 9999 || endY < 1900 || endY > 9999) return false;
    return toMonthIndex(rangeStartMonth, startY) <= toMonthIndex(rangeEndMonth, endY);
  };

  const applyRange = () => {
    if (!isRangeValid()) return;

    onRangeChange({
      startMonth: rangeStartMonth,
      startYear: parseInt(rangeStartYear, 10),
      endMonth: rangeEndMonth,
      endYear: parseInt(rangeEndYear, 10),
    });
    setShowPicker(false);
  };

  const monthLabel =
    startMonth === endMonth && startYear === endYear
      ? `${months[startMonth]} ${startYear}`
      : `${months[startMonth].slice(0, 3)} ${startYear} - ${months[endMonth].slice(0, 3)} ${endYear}`;

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-4 py-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        <Calendar className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-medium text-slate-900">{monthLabel}</span>
      </button>

      {showPicker && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 sm:hidden"
            onClick={() => setShowPicker(false)}
          />

          <div
            className="fixed sm:absolute left-1/2 sm:left-auto sm:right-0 top-1/2 sm:top-full -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 sm:mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-6 z-50 w-[90vw] max-w-[420px] sm:max-w-none sm:w-[420px]"
          >
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'single'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                Single Month
              </button>
              <button
                onClick={() => setActiveTab('range')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'range'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                Month Range
              </button>
            </div>

            {activeTab === 'single' ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Month</h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-1 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Previous month"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-1 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Next month"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {months.map((month, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onMonthChange(idx);
                          setShowPicker(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                          currentMonth === idx
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                            : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        {month.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Year</h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigateYear('prev')}
                        className="p-1 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Previous year"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => navigateYear('next')}
                        className="p-1 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Next year"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={yearInput}
                      onChange={(e) => handleYearInput(e.target.value)}
                      onBlur={handleYearSubmit}
                      onKeyDown={handleYearKeyPress}
                      placeholder="YYYY"
                      maxLength={4}
                      className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors cursor-text"
                    />
                  </div>

                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Enter any year (1900-9999) or use arrows
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Quick Select:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                        <button
                          key={year}
                          onClick={() => {
                            onYearChange(year);
                            setYearInput(year.toString());
                            setShowPicker(false);
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            currentYear === year
                              ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md'
                              : 'bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-600 mb-2">From</p>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <select
                      value={rangeStartMonth}
                      onChange={(e) => setRangeStartMonth(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      {months.map((month, idx) => (
                        <option key={month} value={idx}>{month}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={rangeStartYear}
                      maxLength={4}
                      onChange={(e) => setRangeStartYear(e.target.value.replace(/\D/g, ''))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 text-center bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-600 mb-2">To</p>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <select
                      value={rangeEndMonth}
                      onChange={(e) => setRangeEndMonth(Number(e.target.value))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 bg-white focus:outline-none focus:border-emerald-500"
                    >
                      {months.map((month, idx) => (
                        <option key={month} value={idx}>{month}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={rangeEndYear}
                      maxLength={4}
                      onChange={(e) => setRangeEndYear(e.target.value.replace(/\D/g, ''))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 text-center bg-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {!isRangeValid() && (
                  <p className="text-xs text-rose-600 px-1">
                    End month must be equal to or after start month.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  onMonthChange(today.getMonth());
                  onYearChange(today.getFullYear());
                  onRangeChange({
                    startMonth: today.getMonth(),
                    startYear: today.getFullYear(),
                    endMonth: today.getMonth(),
                    endYear: today.getFullYear(),
                  });
                  setYearInput(today.getFullYear().toString());
                  setRangeStartMonth(today.getMonth());
                  setRangeStartYear(today.getFullYear().toString());
                  setRangeEndMonth(today.getMonth());
                  setRangeEndYear(today.getFullYear().toString());
                  setShowPicker(false);
                }}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'range') {
                    applyRange();
                    return;
                  }
                  onRangeChange({
                    startMonth: currentMonth,
                    startYear: currentYear,
                    endMonth: currentMonth,
                    endYear: currentYear,
                  });
                  setShowPicker(false);
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-lg hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={activeTab === 'range' && !isRangeValid()}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
