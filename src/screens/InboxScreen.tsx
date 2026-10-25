import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ExchangeRequest } from '../types';
import { AcceptDeclineModal } from '../components/AcceptDeclineModal';
import { LeaveReviewModal } from '../components/LeaveReviewModal';
import {
  Inbox,
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  MapPin,
  ShieldCheck,
  Send,
  CornerDownRight,
  Sparkles,
  Calendar,
  AlertCircle,
  Gift,
  Share2,
  Star,
} from 'lucide-react';

export const InboxScreen: React.FC = () => {
  const {
    user,
    incomingRequests,
    outgoingRequests,
    isRequestsLoading,
    refreshRequests,
    acceptRequest,
    declineRequest,
    markHandedOver,
    completeExchange,
    cancelRequest,
    setCurrentScreen,
    openAuthModal,
    openPublicProfile,
    reviewedRequestIds,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [modalRequest, setModalRequest] = useState<ExchangeRequest | null>(null);
  const [modalMode, setModalMode] = useState<'accept' | 'decline' | null>(null);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ExchangeRequest | null>(null);

  // If user is not logged in, prompt sign in
  if (!user) {
    return (
      <div className="space-y-4 pb-24 animate-fade-in">
        <div className="bg-white rounded-3xl p-6 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EAF7F0] flex items-center justify-center text-[#2E9E6B]">
            <Inbox className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sign in to view your Exchange Inbox</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Track borrow requests, claims, and handovers with your local community.
            </p>
          </div>
          <button
            onClick={() => openAuthModal('signin')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] text-white font-semibold text-xs hover:bg-[#237E55] transition-colors shadow-sm"
          >
            Sign In to Account
          </button>
        </div>
      </div>
    );
  }

  const pendingReceivedCount = incomingRequests.filter((r) => r.status === 'pending').length;

  const handleOpenAcceptDecline = (request: ExchangeRequest, mode: 'accept' | 'decline') => {
    setModalRequest(request);
    setModalMode(mode);
  };

  const handleHandover = async (requestId: string) => {
    setIsProcessingId(requestId);
    try {
      await markHandedOver(requestId);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleComplete = async (requestId: string) => {
    setIsProcessingId(requestId);
    try {
      await completeExchange(requestId);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (window.confirm('Are you sure you want to cancel this request?')) {
      setIsProcessingId(requestId);
      try {
        await cancelRequest(requestId);
      } finally {
        setIsProcessingId(null);
      }
    }
  };

  const currentList = activeTab === 'received' ? incomingRequests : outgoingRequests;

  return (
    <div className="space-y-4 pb-28 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentScreen('community')}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to Community"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Exchange Inbox
            </h1>
            <p className="text-xs text-slate-500">Coordinate handovers and second lives</p>
          </div>
        </div>

        <button
          onClick={() => refreshRequests()}
          disabled={isRequestsLoading}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#2E9E6B] transition-colors shadow-2xs"
          title="Refresh requests"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRequestsLoading ? 'animate-spin text-[#2E9E6B]' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-slate-200/70 p-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'received'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Requests I Received</span>
          {pendingReceivedCount > 0 ? (
            <span className="bg-[#2E9E6B] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {pendingReceivedCount}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">({incomingRequests.length})</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'sent'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Requests I Sent</span>
          <span className="text-slate-400 font-normal">({outgoingRequests.length})</span>
        </button>
      </div>

      {/* Privacy Guarantee Pill */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/70 text-[11px] text-slate-600">
        <ShieldCheck className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0" />
        <span className="truncate">
          Privacy Protected: Only approximate neighborhoods are shown to protect your safety.
        </span>
      </div>

      {/* Phase 6B: Safety tips for lending */}
      <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-amber-800">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Safety Tips for Handover</span>
        </div>
        <ul className="list-disc list-inside space-y-0.5 text-amber-950/80 pl-0.5 leading-snug">
          <li>Meet in well-lit public places (e.g. apartment entrance gate, market, society lobby).</li>
          <li>Inspect item condition together before marking handed over or returned.</li>
          <li>Do not share exact flat numbers, private addresses, or banking information.</li>
        </ul>
      </div>

      {/* Loading Skeleton */}
      {isRequestsLoading && currentList.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-4 border border-slate-200 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : currentList.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs space-y-3 my-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              {activeTab === 'received' ? 'No incoming requests yet' : 'You haven’t sent any requests'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              {activeTab === 'received'
                ? 'When neighbors in your area request to borrow or claim your listings, their messages will appear here.'
                : 'Browse the community feed to find tools, appliances, and items available to borrow or claim.'}
            </p>
          </div>
          <button
            onClick={() => setCurrentScreen(activeTab === 'received' ? 'my-listings' : 'community')}
            className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors"
          >
            {activeTab === 'received' ? 'Manage My Listings' : 'Explore Community Feed'}
          </button>
        </div>
      ) : (
        /* List of Requests */
        <div className="space-y-3">
          {currentList.map((req) => {
            const isReceived = activeTab === 'received';
            const isBorrow = req.listingType === 'borrow';
            const otherPersonName = isReceived ? req.requesterName : req.ownerName;
            const otherPersonAvatar = isReceived ? req.requesterAvatar : req.ownerAvatar;
            const otherPersonArea = isReceived ? req.requesterNeighborhood : req.ownerNeighborhood;

            // Status pill styling
            let statusBadge = (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Pending</span>
              </span>
            );

            if (req.status === 'accepted') {
              statusBadge = (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Accepted (Reserved)</span>
                </span>
              );
            } else if (req.status === 'handed_over') {
              statusBadge = (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>Handed Over</span>
                </span>
              );
            } else if (req.status === 'returned' || req.status === 'completed') {
              statusBadge = (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>{isBorrow ? 'Returned' : 'Completed'}</span>
                </span>
              );
            } else if (req.status === 'declined') {
              statusBadge = (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  <span>Declined</span>
                </span>
              );
            } else if (req.status === 'cancelled') {
              statusBadge = (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Cancelled
                </span>
              );
            }

            return (
              <div
                key={req.id}
                className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xs space-y-3 transition-all hover:border-slate-300"
              >
                {/* Header: Item Thumbnail, Title, Type, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img
                      src={req.listingImageUrl}
                      alt={req.listingTitle}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isBorrow ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isBorrow ? 'Borrow' : 'Donate'}
                        </span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[11px] text-slate-500 font-medium">{req.createdAt}</span>
                      </div>
                      <h3 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                        {req.listingTitle}
                      </h3>
                    </div>
                  </div>

                  <div className="shrink-0">{statusBadge}</div>
                </div>

                {/* Counterpart info: Requester or Owner */}
                <div className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-2xl bg-slate-50/80 border border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const otherId = isReceived ? req.requesterId : (req.listingOwnerId || req.ownerId);
                      if (otherId) openPublicProfile(otherId);
                    }}
                    className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity group/counterpart"
                    title="View neighbor profile"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-[#EAF7F0] border border-[#2E9E6B]/40 flex items-center justify-center text-[10px] font-bold text-[#2E9E6B] shrink-0">
                      {otherPersonAvatar ? (
                        <img src={otherPersonAvatar} alt={otherPersonName} className="w-full h-full object-cover" />
                      ) : (
                        otherPersonName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-slate-800 group-hover/counterpart:text-[#2E9E6B] transition-colors">{otherPersonName}</span>
                      <span className="text-[11px] text-slate-500 ml-1.5 flex-inline items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 inline text-slate-400 mr-0.5" />
                        {otherPersonArea}
                      </span>
                    </div>
                  </button>

                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                    {isReceived ? 'Requester' : 'Owner'}
                  </span>
                </div>

                {/* Requester's message */}
                {req.message && (
                  <div className="p-2.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-700 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 block">Message:</span>
                    <p className="italic text-slate-800 leading-relaxed text-[11px]">"{req.message}"</p>
                  </div>
                )}

                {/* Response Note (Owner's note on accept/decline) */}
                {req.responseNote && (
                  <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs text-sky-900 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-sky-700">
                      <CornerDownRight className="w-3 h-3" />
                      <span>Note from {req.ownerName}:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{req.responseNote}</p>
                  </div>
                )}

                {/* Lifecycle Actions */}
                <div className="pt-1">
                  {/* 1. OWNER ACTIONS (Requests I received) */}
                  {isReceived && (
                    <>
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenAcceptDecline(req, 'accept')}
                            disabled={isProcessingId === req.id}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleOpenAcceptDecline(req, 'decline')}
                            disabled={isProcessingId === req.id}
                            className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      )}

                      {req.status === 'accepted' && (
                        <div className="space-y-2">
                          <div className="p-2 bg-sky-50 rounded-xl text-[11px] text-sky-800">
                            Listing is reserved for {req.requesterName}. Once you meet and hand over the item, mark it below:
                          </div>
                          <button
                            onClick={() => handleHandover(req.id)}
                            disabled={isProcessingId === req.id}
                            className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Mark Item Handed Over</span>
                          </button>
                        </div>
                      )}

                      {req.status === 'handed_over' && (
                        <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-600">
                            Item in use with {req.requesterName}.
                          </span>
                          <button
                            onClick={() => handleComplete(req.id)}
                            disabled={isProcessingId === req.id}
                            className="text-[11px] font-semibold text-[#2E9E6B] hover:underline"
                          >
                            Confirm {isBorrow ? 'Return' : 'Receipt'}
                          </button>
                        </div>
                      )}

                      {(req.status === 'returned' || req.status === 'completed') && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-xs text-emerald-950 space-y-2">
                          <div className="flex items-center gap-1.5 font-medium text-emerald-900 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Exchange completed! Circular impact recorded in your Impact tab.</span>
                          </div>

                          {/* Review CTA */}
                          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] text-slate-700 font-medium">
                              {reviewedRequestIds.includes(req.id)
                                ? '✓ You submitted a review for this exchange'
                                : `Rate your exchange with ${otherPersonName}`}
                            </span>
                            {reviewedRequestIds.includes(req.id) ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>Reviewed</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReviewRequest(req)}
                                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Star className="w-3 h-3 fill-white" />
                                <span>Leave Review ⭐</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 2. REQUESTER ACTIONS (Requests I sent) */}
                  {!isReceived && (
                    <>
                      {req.status === 'pending' && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-500">Awaiting owner response...</span>
                          <button
                            onClick={() => handleCancel(req.id)}
                            disabled={isProcessingId === req.id}
                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            Cancel Request
                          </button>
                        </div>
                      )}

                      {req.status === 'accepted' && (
                        <div className="p-2.5 bg-sky-50 rounded-2xl border border-sky-100 text-[11px] text-sky-900 leading-relaxed">
                          🎉 {req.ownerName} accepted your request! Coordinate pickup at the approximate neighborhood location.
                        </div>
                      )}

                      {req.status === 'handed_over' && (
                        <div className="space-y-2">
                          <div className="p-2 bg-indigo-50 rounded-xl text-[11px] text-indigo-900">
                            {isBorrow
                              ? 'Item is currently with you. When finished, mark it returned:'
                              : 'Item handed over! Confirm receipt below:'}
                          </div>
                          <button
                            onClick={() => handleComplete(req.id)}
                            disabled={isProcessingId === req.id}
                            className="w-full py-2 px-3 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isBorrow ? 'I Have Returned This Item' : 'I Have Received This Item'}</span>
                          </button>
                        </div>
                      )}

                      {(req.status === 'returned' || req.status === 'completed') && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-xs text-emerald-950 space-y-2">
                          <div className="flex items-center gap-1.5 font-medium text-emerald-900 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Closed loop! You saved waste and money with this circular exchange.</span>
                          </div>

                          {/* Review CTA */}
                          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] text-slate-700 font-medium">
                              {reviewedRequestIds.includes(req.id)
                                ? '✓ You submitted a review for this exchange'
                                : `Rate your exchange with ${otherPersonName}`}
                            </span>
                            {reviewedRequestIds.includes(req.id) ? (
                              <span className="text-[11px] font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>Reviewed</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReviewRequest(req)}
                                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                              >
                                <Star className="w-3 h-3 fill-white" />
                                <span>Leave Review ⭐</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept / Decline Modal with Optional Note */}
      <AcceptDeclineModal
        request={modalRequest}
        mode={modalMode}
        onClose={() => {
          setModalRequest(null);
          setModalMode(null);
        }}
        onConfirm={async (requestId, note) => {
          if (modalMode === 'accept') {
            return acceptRequest(requestId, note);
          } else {
            return declineRequest(requestId, note);
          }
        }}
      />

      {/* Leave Review Modal */}
      <LeaveReviewModal
        request={reviewRequest}
        onClose={() => setReviewRequest(null)}
      />
    </div>
  );
};
