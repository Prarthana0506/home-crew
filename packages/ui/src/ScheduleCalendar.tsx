import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from './Button';

export interface CalendarBookingItem {
  id: string;
  time_range: string;
  status: string;
  request?: {
    id: string;
    title: string;
    type: 'ordinary' | 'emergency';
    offered_price?: number;
    category?: { name: string };
    area?: { name: string };
    customer?: { name: string; phone?: string };
  } | null;
}

export interface ScheduleCalendarProps {
  bookings: CalendarBookingItem[];
  role?: 'provider' | 'customer';
  minGapHours?: number;
  onSelectBooking?: (booking: CalendarBookingItem) => void;
}

// Helper to parse Postgres tstzrange "[2026-10-14 02:30:00+00,2026-10-14 04:30:00+00)"
function parseRange(rangeStr: string): { start: Date; end: Date } {
  try {
    const cleaned = rangeStr.replace(/[[()\]]/g, '');
    const parts = cleaned.split(',');
    if (parts.length >= 2) {
      return {
        start: new Date(parts[0]),
        end: new Date(parts[1])
      };
    }
  } catch {
    // ignore
  }
  const now = new Date();
  return { start: now, end: new Date(now.getTime() + 2 * 60 * 60 * 1000) };
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  bookings,
  role = 'provider',
  minGapHours = 4.0,
  onSelectBooking
}) => {
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Week calculation
  const startOfWeek = new Date(currentDate);
  const dayIndex = (startOfWeek.getDay() + 6) % 7; // Monday = 0
  startOfWeek.setDate(startOfWeek.getDate() - dayIndex);
  startOfWeek.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate Next Free Slot after 8-hour gap rule
  const calculateNextFreeSlot = () => {
    const now = new Date();
    const sortedUpcoming = bookings
      .map(b => ({ ...b, parsed: parseRange(b.time_range) }))
      .filter(b => b.parsed.end >= now)
      .sort((a, b) => a.parsed.start.getTime() - b.parsed.start.getTime());

    if (sortedUpcoming.length === 0) {
      // Free starting from today operating hours or tomorrow 8 AM
      const candidate = new Date(now);
      const currentHour = candidate.getHours();
      if (currentHour >= 19) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(8, 0, 0, 0);
      } else if (currentHour < 8) {
        candidate.setHours(8, 0, 0, 0);
      } else {
        candidate.setHours(currentHour + 1, 0, 0, 0);
      }
      return {
        slot: candidate,
        detail: 'Immediate availability during operating hours (8 AM to 7 PM IST)'
      };
    }

    // Check gap after each booking
    const nextBooking = sortedUpcoming[0];
    const afterGap = new Date(nextBooking.parsed.end.getTime() + minGapHours * 60 * 60 * 1000);

    // If afterGap falls after 7 PM IST (19:00) or before 8 AM IST (08:00), snap to 8 AM next day
    const hour = afterGap.getHours();
    if (hour >= 19) {
      afterGap.setDate(afterGap.getDate() + 1);
      afterGap.setHours(8, 0, 0, 0);
    } else if (hour < 8) {
      afterGap.setHours(8, 0, 0, 0);
    }

    return {
      slot: afterGap,
      detail: `${minGapHours}-hour mandatory gap observed after booking "${nextBooking.request?.title || 'Assignment'}" ending at ${nextBooking.parsed.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    };
  };

  const nextFreeInfo = calculateNextFreeSlot();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Next Free Slot Card */}
      <div
        style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid var(--color-teal-dark)',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '2px 2px 0px var(--color-teal-dark)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#dcfce7',
              border: '2px solid var(--color-teal-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-teal-dark)'
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-teal-dark)' }}>
              Next Free Slot ({minGapHours}-Hour Mandatory Gap)
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-dark)', marginTop: '2px' }}>
              {nextFreeInfo.slot.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
              {nextFreeInfo.slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '2px' }}>
              {nextFreeInfo.detail}
            </div>
          </div>
        </div>

        <span className="flat-badge badge-verified" style={{ fontSize: '0.74rem' }}>
          GAP RULE ENFORCED
        </span>
      </div>

      {/* 2. Calendar Header Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '2px solid var(--color-teal-dark)',
          boxShadow: 'var(--shadow-flat)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button size="sm" variant="secondary" onClick={handlePrev}>
            <ChevronLeft size={16} />
          </Button>
          <Button size="sm" variant="secondary" onClick={handleToday}>
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={handleNext}>
            <ChevronRight size={16} />
          </Button>
          <span style={{ fontWeight: 800, fontSize: '0.98rem', marginLeft: '6px' }}>
            {viewMode === 'week'
              ? `${startOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric' })} to ${weekDays[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* View Switcher: Week vs Day */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`btn-flat btn-flat-sm ${viewMode === 'week' ? '' : 'btn-flat-secondary'}`}
          >
            Week View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`btn-flat btn-flat-sm ${viewMode === 'day' ? '' : 'btn-flat-secondary'}`}
          >
            Day View
          </button>
        </div>
      </div>

      {/* 3. Week View Grid */}
      {viewMode === 'week' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            overflowX: 'auto'
          }}
        >
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const dayBookings = bookings.filter(b => {
              const { start } = parseRange(b.time_range);
              return start.toDateString() === day.toDateString();
            });

            return (
              <div
                key={idx}
                style={{
                  minHeight: '260px',
                  backgroundColor: '#ffffff',
                  border: `2px solid ${isToday ? 'var(--color-teal-dark)' : 'var(--color-border)'}`,
                  borderRadius: '10px',
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: isToday ? '3px 3px 0px var(--color-teal-dark)' : 'none'
                }}
              >
                {/* Day Header */}
                <div style={{ textAlign: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                    {day.toLocaleDateString([], { weekday: 'short' })}
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      color: isToday ? 'var(--color-teal-dark)' : 'var(--color-dark)'
                    }}
                  >
                    {day.getDate()}
                  </div>
                </div>

                {/* Day Bookings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  {dayBookings.length === 0 ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', textAlign: 'center', marginTop: '20px' }}>
                      No visits
                    </div>
                  ) : (
                    dayBookings.map(b => {
                      const { start } = parseRange(b.time_range);
                      const isEmergency = b.request?.type === 'emergency';
                      const isHold = b.status === 'hold';

                      return (
                        <div
                          key={b.id}
                          onClick={() => onSelectBooking?.(b)}
                          style={{
                            backgroundColor: isEmergency ? 'var(--color-coral-light)' : '#e6f4f1',
                            border: `2px solid ${isEmergency ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                            borderRadius: '6px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            fontSize: '0.74rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                color: isEmergency ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'
                              }}
                            >
                              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span
                              className={`flat-badge ${isHold ? 'badge-warning' : isEmergency ? 'badge-emergency' : 'badge-ordinary'}`}
                              style={{ fontSize: '0.62rem', padding: '1px 4px' }}
                            >
                              {isHold ? '2h Hold' : isEmergency ? 'Urgent' : 'Standard'}
                            </span>
                          </div>

                          <div style={{ fontWeight: 800, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.request?.title || 'Home Service'}
                          </div>
                          <div style={{ color: 'var(--color-muted)', fontSize: '0.68rem' }}>
                            {b.request?.area?.name || 'Coimbatore'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Day View Detailed Timeline */}
      {viewMode === 'day' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '2px solid var(--color-teal-dark)',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                Operating Hours: 08:00 AM to 07:00 PM IST
              </div>
            </div>
            <span className="flat-badge badge-ordinary">
              {bookings.filter(b => parseRange(b.time_range).start.toDateString() === currentDate.toDateString()).length} Scheduled Visits
            </span>
          </div>

          {/* Hourly Slots (8 AM to 7 PM) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
              const hourLabel = `${hour < 10 ? '0' + hour : hour}:00`;
              const hourDate = new Date(currentDate);
              hourDate.setHours(hour, 0, 0, 0);

              const matchingBookings = bookings.filter(b => {
                const { start, end } = parseRange(b.time_range);
                return start.toDateString() === currentDate.toDateString() &&
                       start.getHours() <= hour &&
                       end.getHours() > hour;
              });

              return (
                <div
                  key={hour}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr',
                    alignItems: 'center',
                    gap: '12px',
                    borderBottom: '1px dashed #e2e8f0',
                    paddingBottom: '8px'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)' }}>
                    {hourLabel}
                  </div>

                  <div>
                    {matchingBookings.length === 0 ? (
                      <div style={{ height: '24px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px dashed #cbd5e1' }} />
                    ) : (
                      matchingBookings.map(b => {
                        const isEmergency = b.request?.type === 'emergency';
                        const isHold = b.status === 'hold';
                        return (
                          <div
                            key={b.id}
                            onClick={() => onSelectBooking?.(b)}
                            style={{
                              backgroundColor: isEmergency ? 'var(--color-coral-light)' : '#e6f4f1',
                              border: `2px solid ${isEmergency ? 'var(--color-terracotta)' : 'var(--color-teal-dark)'}`,
                              borderRadius: '6px',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 800, fontSize: '0.86rem' }}>
                                {b.request?.title || 'Home Service'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginLeft: '8px' }}>
                                Locality: {b.request?.area?.name} | {role === 'provider' ? `Customer: ${b.request?.customer?.name || 'Client'}` : `Price: Rs ${b.request?.offered_price}`}
                              </span>
                            </div>

                            <span
                              className={`flat-badge ${isHold ? 'badge-warning' : isEmergency ? 'badge-emergency' : 'badge-ordinary'}`}
                              style={{ fontSize: '0.68rem' }}
                            >
                              {isHold ? '2-Hour Pending Hold' : isEmergency ? 'Emergency' : 'Standard'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
