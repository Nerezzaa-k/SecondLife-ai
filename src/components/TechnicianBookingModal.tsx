import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Technician } from '../types';
import { X, Calendar, Clock, CheckCircle2, ShieldCheck, MapPin, Wrench } from 'lucide-react';

interface TechnicianBookingModalProps {
  technician: Technician | null;
  itemName: string;
  onClose: () => void;
}

export const TechnicianBookingModal: React.FC<TechnicianBookingModalProps> = ({
  technician,
  itemName,
  onClose,
}) => {
  const { createBooking } = useApp();
  const [selectedDate, setSelectedDate] = useState('2026-10-25');
  const [selectedTime, setSelectedTime] = useState('11:00 AM');
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!technician) return null;

  const timeSlots = ['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBooking(technician, itemName, selectedDate, selectedTime, notes);
    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Booking Confirmed!
            </h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              {technician.name} has accepted your repair diagnostic request for{' '}
              <strong className="text-slate-900">{itemName}</strong> on {selectedDate} at {selectedTime}.
            </p>
            <div className="p-3 bg-emerald-50 rounded-xl text-xs font-semibold text-emerald-800">
              Check your notification & bookings in Impact dashboard.
            </div>
          </div>
        ) : (
          <div>
            {/* Technician Profile Snapshot */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
              <img
                src={technician.avatar}
                alt={technician.name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-slate-900">
                    {technician.name}
                  </h4>
                  {technician.verifiedBadge && (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500">{technician.specialty}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                  <span>★ {technician.rating} ({technician.reviewsCount})</span>
                  <span>·</span>
                  <span className="text-emerald-700 font-semibold">{technician.priceRange}</span>
                </div>
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Book Diagnostic Visit
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Item to inspect: <strong className="text-slate-800">{itemName}</strong>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Preferred Date</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min="2026-10-24"
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                  required
                />
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Available Slot</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {timeSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        selectedTime === slot
                          ? 'bg-[#2E9E6B] text-white border-[#2E9E6B] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Problem notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Extra notes for technician (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please bring small soldering iron or multi-meter"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Confirm Diagnostic Booking</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
