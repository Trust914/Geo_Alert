import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, Cloud, Shield, Flame, Car, Leaf, Zap, MoreHorizontal,
  Eye, Send, Ban, MapPin, Users, XCircle, CheckCircle2, Loader2,
  RefreshCw, Calendar, UserCheck
} from "lucide-react";
import { Card, CardContent } from "../../../components/ui/";
import { Button } from "../../../components/ui/Button/";
import { Input } from "../../../components/ui/Input/";
import type { Alert, AlertCategory, AlertSeverity, AlertStatus } from "../types/";
import { formatDistanceToNow } from "date-fns";
import { useSendAlert, useCancelAlert } from "../hooks/";

interface AlertCardProps {
  alert: Alert;
}

export function AlertCard({ alert }: AlertCardProps) {
  const navigate = useNavigate();
  const [showSendModal, setShowSendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const { mutate: sendAlert, isPending: isSending } = useSendAlert();
  const { mutate: cancelAlert, isPending: isCancelling } = useCancelAlert();

  const categoryConfig = getCategoryConfig(alert.category);
  const severityConfig = getSeverityConfig(alert.severity);
  const statusConfig = getStatusConfig(alert.status);

  const showSendButton = alert.status === "DRAFT" || alert.status === "FAILED";
  const isActiveAlert = alert.status === "PENDING" || alert.status === "SENT";

  const handleSend = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!twoFactorCode) return;

    sendAlert(
      { id: alert.id, code: twoFactorCode },
      {
        onSuccess: () => {
          setShowSendModal(false);
          setTwoFactorCode("");
        },
      }
    );
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!twoFactorCode || !cancelReason) return;

    cancelAlert(
      { id: alert.id, code: twoFactorCode, reason: cancelReason },
      {
        onSuccess: () => {
          setShowCancelModal(false);
          setTwoFactorCode("");
          setCancelReason("");
        },
      }
    );
  };

  return (
    <>
      <Card className="hover:shadow-xl transition-all duration-300 hover:border-emerald-500/50 hover:scale-[1.01]">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Left Section */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`p-2.5 rounded-lg ${categoryConfig.bgColor} border ${categoryConfig.borderColor} shadow-sm`}
                  title={categoryConfig.label}
                >
                  <categoryConfig.icon className={`w-5 h-5 ${categoryConfig.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                      {alert.headline}
                    </h3>

                    {/* Status indicator icon */}
                    {alert.status === "DELIVERED" && (
                      <div className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      </div>
                    )}
                    {(alert.status === "FAILED" || alert.status === "CANCELLED") && (
                      <div className="p-1 rounded-full bg-red-100 dark:bg-red-900/30">
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      </div>
                    )}
                    {isActiveAlert && (
                      <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Severity Badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${severityConfig.className} shadow-sm`}>
                      {severityConfig.icon} {severityConfig.label}
                    </span>

                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.className} shadow-sm`}>
                      {statusConfig.label}
                    </span>

                    {/* Category Badge */}
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {categoryConfig.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed">
                {alert.description}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                {/* Location */}
                {alert.targets && alert.targets.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-medium">{alert.targets[0].locationName}</span>
                    {alert.targets.length > 1 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{alert.targets.length - 1}
                      </span>
                    )}
                  </div>
                )}

                {/* Recipients */}
                {alert._count && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-medium">{alert._count.deliveries.toLocaleString()}</span>
                  </div>
                )}

                {/* Time */}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                </div>

                {/* Created By */}
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    {alert.createdBy.firstName} {alert.createdBy.lastName}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Section - Actions */}
            <div className="flex flex-col items-end gap-2">
              {/* View Button - Always visible */}
              <Link to={`/alerts/${alert.id}`} className="w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Eye className="w-4 h-4" />}
                  className="w-full justify-start"
                >
                  View Details
                </Button>
              </Link>

              {/* Send Button - Only for Draft or Failed alerts */}
              {/* {showSendButton && (
                <Button
                  variant="default"
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 w-full justify-start shadow-sm"
                  leftIcon={alert.status === "FAILED" ? <RefreshCw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSendModal(true);
                  }}
                >
                  {alert.status === "FAILED" ? "Retry" : "Send"}
                </Button>
              )} */}

              {/* Cancel Button - Only for actively sending alerts */}
              {isActiveAlert && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 w-full justify-start"
                  leftIcon={<Ban className="w-4 h-4" />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowCancelModal(true);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowSendModal(false);
            setTwoFactorCode("");
          }
        }}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {alert.status === "FAILED" ? "Retry Send Alert" : "Send Alert"}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Enter your 2FA code to confirm sending this alert.
                </p>
              </div>

              {alert.status === "FAILED" && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ This alert previously failed. Make sure to review the alert details before retrying.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2FA Code</label>
                <Input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowSendModal(false);
                  setTwoFactorCode("");
                }} disabled={isSending}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSend}
                  disabled={!twoFactorCode || twoFactorCode.length !== 6 || isSending}
                  isLoading={isSending}
                >
                  Confirm {alert.status === "FAILED" ? "Retry" : "Send"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowCancelModal(false);
            setTwoFactorCode("");
            setCancelReason("");
          }
        }}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cancel Alert</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This will stop the alert distribution.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cancellation Reason</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling this alert?"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2FA Code</label>
                <Input type="text" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => {
                  setShowCancelModal(false);
                  setTwoFactorCode("");
                  setCancelReason("");
                }} disabled={isCancelling}>
                  Back
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleCancel}
                  disabled={!twoFactorCode || !cancelReason || isCancelling}
                  isLoading={isCancelling}
                >
                  Confirm Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function getCategoryConfig(category: AlertCategory) {
  const configs: Record<AlertCategory, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
    WEATHER: {
      label: "Weather",
      icon: Cloud,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800/30",
    },
    GEOPHYSICAL: {
      label: "Geological",
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-200 dark:border-amber-800/30",
    },
    METEOROLOGICAL: {
      label: "Meteorological",
      icon: Cloud,
      color: "text-sky-600",
      bgColor: "bg-sky-50 dark:bg-sky-900/20",
      borderColor: "border-sky-200 dark:border-sky-800/30",
    },
    SAFETY: {
      label: "Public Safety",
      icon: Shield,
      color: "text-rose-600",
      bgColor: "bg-rose-50 dark:bg-rose-900/20",
      borderColor: "border-rose-200 dark:border-rose-800/30",
    },
    SECURITY: {
      label: "Security",
      icon: Shield,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800/30",
    },
    RESCUE: {
      label: "Rescue",
      icon: Users,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
      borderColor: "border-cyan-200 dark:border-cyan-800/30",
    },
    HEALTH: {
      label: "Health",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      borderColor: "border-purple-200 dark:border-purple-800/30",
    },
    FIRE: {
      label: "Fire",
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      borderColor: "border-orange-200 dark:border-orange-800/30",
    },
    TRANSPORT: {
      label: "Transport",
      icon: Car,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
      borderColor: "border-indigo-200 dark:border-indigo-800/30",
    },
    ENVIRONMENTAL: {
      label: "Environment",
      icon: Leaf,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800/30",
    },
    INFRASTRUCTURE: {
      label: "Infrastructure",
      icon: Zap,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-800/30",
    },
    CBRNE: {
      label: "CBRNE",
      icon: Shield,
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-900/20",
      borderColor: "border-violet-200 dark:border-violet-800/30",
    },
    OTHER: {
      label: "Other",
      icon: MoreHorizontal,
      color: "text-gray-600",
      bgColor: "bg-gray-50 dark:bg-gray-900/20",
      borderColor: "border-gray-200 dark:border-gray-800/30",
    },
  };

  return configs[category] || configs.OTHER;
}

function getSeverityConfig(severity: AlertSeverity) {
  const configs: Record<AlertSeverity, { label: string; icon: string; className: string }> = {
    EXTREME: {
      label: "Extreme",
      icon: "⚡",
      className: "bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700",
    },
    SEVERE: {
      label: "Severe",
      icon: "🚨",
      className: "bg-gradient-to-r from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700",
    },
    MODERATE: {
      label: "Moderate",
      icon: "⚠️",
      className: "bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700",
    },
    MINOR: {
      label: "Minor",
      icon: "ℹ️",
      className: "bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700",
    },
  };

  return configs[severity];
}

function getStatusConfig(status: AlertStatus) {
  const configs: Record<AlertStatus, { label: string; className: string }> = {
    DRAFT: {
      label: "Draft",
      className: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600",
    },
    PENDING: {
      label: "Pending",
      className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700",
    },
    SENT: {
      label: "Sending",
      className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700",
    },
    DELIVERED: {
      label: "Delivered",
      className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700",
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700",
    },
    FAILED: {
      label: "Failed",
      className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700",
    },
    EXPIRED: {
      label: "Expired",
      className: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600",
    },
  };

  return configs[status];
}