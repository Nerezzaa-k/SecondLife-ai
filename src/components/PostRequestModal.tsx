import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, PlusCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

interface PostRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PostRequestModal: React.FC<PostRequestModalProps> = ({ isOpen, onClose }) => {
  const { showToast, userName } = useApp();
  const [itemNeeded, setItemNeeded] = useState('');
  const [duration, setDuration] = useState('2 days');
  const [urgency, setUrgency] = useState('This week');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNeeded.trim()) return;
    showToast(`Request for "${itemNeeded}" posted to your neighborhood circle! 📢`, 'success');
    setItemNeeded('');
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Post an Item Request
            </h3>
            <p className="text-[11px] text-slate-500">
              Ask your local circle to lend or donate
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              What do you need?
            </label>
            <input
              type="text"
              value={itemNeeded}
              onChange={(e) => setItemNeeded(e.target.value)}
              placeholder="e.g. Lawn mower, Camping tent, Extension cord"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Duration needed
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              >
                <option value="Few hours">Few hours</option>
                <option value="1-2 days">1-2 days</option>
                <option value="Weekend">Weekend</option>
                <option value="1 week">1 week</option>
                <option value="Keep / Donate">Keep / Donate</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                When?
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              >
                <option value="Today / Urgent">Today / Urgent</option>
                <option value="This week">This week</option>
                <option value="Coming weekend">Coming weekend</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Why do you need it? (helps neighbors offer)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Assembling a bookshelf this Saturday; only need it for 2 hours."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Publish Request to Neighbors</span>
          </button>
        </form>
      </div>
    </div>
  );
};
