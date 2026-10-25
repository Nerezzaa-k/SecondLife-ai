import React, { useState } from 'react';
import { X, ShieldAlert, FileText, Lock, AlertTriangle, Trash2, HeartHandshake } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {activeTab === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </h3>
              <p className="text-[10px] text-slate-500">SecondLife AI Legal & Safety</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prototype Stage Notice */}
        <div className="my-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Prototype Stage Draft:</strong> This document is a plain-language summary for prototype testing and requires professional legal review before general public commercial launch.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'terms'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 text-xs text-slate-600 space-y-4 leading-relaxed flex-1">
          {activeTab === 'privacy' ? (
            <>
              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">1. What Data We Collect</h4>
                <p>
                  To enable peer-to-peer sharing and circular diagnostics, SecondLife AI collects:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li><strong>Account Information:</strong> Your email address, chosen display name, and avatar.</li>
                  <li><strong>Item Photos & Media:</strong> Images and condition videos you upload to analyze or list.</li>
                  <li><strong>Approximate Location:</strong> Your stated neighborhood or city. We never collect or share exact street addresses, GPS coordinates, or apartment numbers.</li>
                  <li><strong>Circular Activity:</strong> Aggregated counts of repairs, borrowings, and donations, along with calculated waste (kg) and CO2 (kg) diverted.</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">2. Third-Party Media & AI Processing</h4>
                <p>
                  We utilize specialized cloud services to power our circular engine:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li><strong>Cloudinary:</strong> Uploaded images and condition clips are hosted and processed by Cloudinary for automatic tag generation, automated content moderation, perceptual hash generation (duplicate detection), and bandwidth-efficient responsive delivery.</li>
                  <li><strong>Google Gemini Vision:</strong> Item photos and descriptions are analyzed by Google's Gemini Multimodal API to estimate repairability, categorize items, identify potential wear, and estimate carbon diversion metrics. Data sent for analysis is governed by enterprise API confidentiality practices.</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">3. How to Delete Your Account and Data</h4>
                <p>
                  You maintain complete ownership of your data. You can permanently delete your account at any time:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Open your <strong>Profile</strong> modal from the top navigation bar.</li>
                  <li>Click <strong>Delete Account & Data</strong> in the Danger Zone at the bottom.</li>
                  <li>Confirming will immediately and irrevocably erase your profile, listings, exchange requests, reviews, and circular impact records from our active databases.</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">4. Leaderboard & Public Visibility</h4>
                <p>
                  Opting into the community leaderboard displays only your first name, neighborhood, and cumulative carbon savings. Surnames, contact information, and individual exchange details are never published on the leaderboard.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">1. Voluntary Community Platform</h4>
                <p>
                  SecondLife AI is a voluntary neighborhood exchange network designed to keep functional goods in active circulation. By participating, you agree to treat neighbors with respect and handle borrowed items with care.
                </p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">2. Sharing at Your Own Risk</h4>
                <p>
                  All lending, borrowing, and donation activities are conducted entirely at the mutual discretion and risk of participating community members:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>SecondLife AI does not physically inspect, store, or warrant the safety, cleanliness, structural integrity, or fitness for purpose of any listed item.</li>
                  <li>Borrowers and lenders must inspect items together during physical handover.</li>
                  <li>SecondLife AI is not liable for item loss, mechanical breakdown, or personal injury occurring during or after community exchanges.</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">3. AI Estimates are Not Professional Advice</h4>
                <p>
                  Diagnostics, estimated repair costs, carbon savings, and troubleshooting tips generated by Gemini Vision or offline diagnostic heuristics are <strong>preliminary algorithmic approximations</strong>:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Estimates do not replace diagnostic inspection by a certified electrical or mechanical technician.</li>
                  <li>Always disconnect mains power and observe safety guidelines before inspecting appliances or tools.</li>
                  <li>Consult a licensed professional for safety-critical appliances (e.g. high-voltage wiring, gas fittings, pressure vessels).</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-xs">4. Prohibited Items</h4>
                <p>
                  Users may not list weapons, toxic substances, illegal goods, expired medical supplies, or recalled child safety equipment. Violations result in immediate listing removal and account termination.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Version 1.0 (Prototype Draft)</span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
