'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DAYS = [
  { key: 1, label: 'Lun' },
  { key: 2, label: 'Mar' },
  { key: 3, label: 'Mié' },
  { key: 4, label: 'Jue' },
  { key: 5, label: 'Vie' },
  { key: 6, label: 'Sáb' },
  { key: 0, label: 'Dom' },
];

export interface DaySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AvailabilityPickerProps {
  value: DaySlot[];
  onChange: (slots: DaySlot[]) => void;
  disabled?: boolean;
}

export function AvailabilityPicker({ value, onChange, disabled }: AvailabilityPickerProps) {
  const getSlot = (day: number): DaySlot | undefined =>
    value.find((s) => s.dayOfWeek === day);

  const isActive = (day: number) => !!getSlot(day);

  function toggleDay(day: number) {
    if (isActive(day)) {
      onChange(value.filter((s) => s.dayOfWeek !== day));
    } else {
      onChange([...value, { dayOfWeek: day, startTime: '08:00', endTime: '18:00' }]);
    }
  }

  function updateSlot(day: number, field: 'startTime' | 'endTime', time: string) {
    onChange(
      value.map((s) => (s.dayOfWeek === day ? { ...s, [field]: time } : s))
    );
  }

  return (
    <div className="space-y-3">
      {/* Chips de días */}
      <div className="flex gap-2 flex-wrap">
        {DAYS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => toggleDay(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              isActive(key)
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Franjas de los días activos */}
      {value.length > 0 && (
        <div className="space-y-2 pl-1">
          {DAYS.filter(({ key }) => isActive(key)).map(({ key, label }) => {
            const slot = getSlot(key)!;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 w-8">{label}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(key, 'startTime', e.target.value)}
                    disabled={disabled}
                    className="w-32 text-sm"
                  />
                  <span className="text-slate-400 text-sm">a</span>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(key, 'endTime', e.target.value)}
                    disabled={disabled}
                    className="w-32 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-sm text-slate-400 italic">Selecciona los días disponibles para visitas.</p>
      )}
    </div>
  );
}
