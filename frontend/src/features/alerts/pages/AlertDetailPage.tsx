import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Ban,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  RotateCcw,
  UserCheck,
  UserX,
  Calendar,
  Activity,
  Mail,
  Smartphone,
} from "lucide-react";
import {
  useAlert,
  useAlertStatistics,
  useSendAlert,
  useCancelAlert,
  useAlertPreview,
  useInitiateStepUpOTP,
} from "../hooks/";
import { Button } from "../../../components/ui/";
import { Card, CardContent, CardHeader } from "../../../components/ui/";
import { Input } from "../../../components/ui/";
import { formatDistanceToNow, format } from "date-fns";
import { AlertStatus } from "../types/";
import { useBFF } from "../../bff_auth/context";

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- Auth (for 2FA method detection) ---
  const { user } = useBFF();
  const twoFactorMethod = user?.twoFactorMethod ?? "NONE";
  const isTwoFactorEnabled = user?.isTwoFactorEnabled ?? false;

  // --- Modal state ---
  const [showSendModal, setShowSendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [otpSentForSend, setOtpSentForSend] = useState(false);
  const [otpSentForCancel, setOtpSentForCancel] = useState(false);

  // --- Data hooks ---
  const { data: alertData, isLoading } = useAlert(id!);
  const { data: statsData } = useAlertStatistics(id!);
  const { data: previewData } = useAlertPreview(id!);
  const { mutate: sendAlert, isPending: isSending } = useSendAlert();
  const { mutate: cancelAlert, isPending: isCancelling } = useCancelAlert();
  const { mutate: initiateOTP, isPending: isInitiatingOTP } = useInitiateStepUpOTP();

  // ── Fire OTP email when Send modal opens ──────────────────────────────────
  useEffect(() => {
    if (showSendModal && isTwoFactorEnabled && twoFactorMethod === "EMAIL" && !otpSentForSend) {
      initiateOTP(undefined, {
        onSuccess: () => setOtpSentForSend(true),
        onError: () => setOtpSentForSend(true),
      });
    }
  }, [showSendModal, isTwoFactorEnabled, twoFactorMethod, otpSentForSend, initiateOTP]);

  // ── Fire OTP email when Cancel modal opens ────────────────────────────────
  useEffect(() => {
    if (
      showCancelModal &&
      isTwoFactorEnabled &&
      twoFactorMethod === "EMAIL" &&
      !otpSentForCancel
    ) {
      initiateOTP(undefined, {
        onSuccess: () => setOtpSentForCancel(true),
        onError: () => setOtpSentForCancel(true),
      });
    }
  }, [showCancelModal, isTwoFactorEnabled, twoFactorMethod, otpSentForCancel, initiateOTP]);

  // Reset OTP flags when modals close
  useEffect(() => {
    if (!showSendModal) setOtpSentForSend(false);
  }, [showSendModal]);

  useEffect(() => {
    if (!showCancelModal) setOtpSentForCancel(false);
  }, [showCancelModal]);

  // ── Loading / not-found guards ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!alertData?.data) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alert not found</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          The alert you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate("/alerts")} className="mt-6">
          Back to Alerts
        </Button>
      </Card>
    );
  }

  const alert = alertData.data;
  const stats = statsData?.data;
  const preview = previewData?.data;

  // ── Derived status ─────────────────────────────────────────────────────────
  const getActualStatus = () => {
    if (alert.status === AlertStatus.CANCELLED) return AlertStatus.CANCELLED;
    if (alert.status === AlertStatus.DRAFT) return AlertStatus.DRAFT;
    if (alert.status === AlertStatus.FAILED) return AlertStatus.FAILED;
    if (alert.status === AlertStatus.PENDING) return AlertStatus.PENDING;

    if (stats && alert.status === AlertStatus.SENT) {
      if (stats.delivered === stats.total && stats.total > 0) return AlertStatus.DELIVERED;
      if (stats.failed === stats.total && stats.total > 0) return AlertStatus.FAILED;
      if (stats.delivered > 0 && stats.pending === 0) return AlertStatus.DELIVERED;
      if (stats.queued > 0 || stats.pending > 0) return AlertStatus.PENDING;
    }

    return alert.status;
  };

  const actualStatus = getActualStatus();

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSend = () => {
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

  const handleCancel = () => {
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

  // ── Helper: 2FA hint text ──────────────────────────────────────────────────
  const getTwoFactorHint = () => {
    if (!isTwoFactorEnabled) return null;
    if (twoFactorMethod === "EMAIL") {
      return (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Mail className="w-3 h-3" />
          A verification code has been sent to your email address.
        </p>
      );
    }
    if (twoFactorMethod === "GOOGLE_AUTHENTICATOR") {
      return (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Smartphone className="w-3 h-3" />
          Check your authenticator app for the code.
        </p>
      );
    }
    return <p className="text-xs text-gray-500 mt-1">Enter your 2FA verification code.</p>;
  };

  // ── Status presentation helpers ────────────────────────────────────────────
  const getStatusIcon = () => {
    switch (actualStatus) {
      case AlertStatus.DELIVERED:
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case AlertStatus.FAILED:
      case AlertStatus.CANCELLED:
        return <XCircle className="w-5 h-5 text-red-600" />;
      case AlertStatus.PENDING:
      case AlertStatus.SENT:
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = () => {
    switch (actualStatus) {
      case AlertStatus.DELIVERED:
        return "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800";
      case AlertStatus.FAILED:
      case AlertStatus.CANCELLED:
        return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";
      case AlertStatus.PENDING:
      case AlertStatus.SENT:
        return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
      default:
        return "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800";
    }
  };

  const getStatusMessage = () => {
    switch (actualStatus) {
      case AlertStatus.DRAFT:
        return "This alert is in draft mode and hasn't been sent yet.";
      case AlertStatus.PENDING:
        return "This alert is queued and will be sent shortly.";
      case AlertStatus.SENT:
        if (stats && stats.pending > 0) {
          return `This alert is being delivered. ${stats.delivered} of ${stats.total} delivered so far.`;
        }
        return "This alert has been sent and delivery is in progress.";
      case AlertStatus.DELIVERED:
        return `This alert has been successfully delivered to all ${stats?.total || 0} recipients.`;
      case AlertStatus.CANCELLED:
        return `This alert was cancelled. Reason: ${alert.cancelReason || "Not specified"}`;
      case AlertStatus.FAILED:
        return "This alert failed to send. Please review the details and try again.";
      default:
        return "";
    }
  };

  const canCancel =
    alert.status === AlertStatus.DRAFT ||
    ((alert.status === AlertStatus.PENDING || alert.status === AlertStatus.SENT) &&
      stats &&
      stats.pending > 0);

  const canSend =
    alert.status === AlertStatus.DRAFT || alert.status === AlertStatus.FAILED;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate("/alerts")}
            className="mt-1"
          >
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon()}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {alert.headline}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={<Eye className="w-4 h-4" />}
            onClick={() => setShowPreviewModal(true)}
          >
            Preview
          </Button>

          {canSend && (
            <Button
              variant="default"
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
              leftIcon={
                alert.status === AlertStatus.FAILED ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )
              }
              onClick={() => setShowSendModal(true)}
            >
              {alert.status === AlertStatus.FAILED ? "Retry Send" : "Send Alert"}
            </Button>
          )}

          {canCancel && (
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
              leftIcon={<Ban className="w-4 h-4" />}
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Alert
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <Card className={`border-2 ${getStatusColor()}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white text-lg">
                  {actualStatus}
                </span>
                {alert.status === AlertStatus.SENT && stats && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({stats.delivered}/{stats.total} delivered)
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{getStatusMessage()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Alert details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alert Information */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Alert Information
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Description
                </label>
                <p className="mt-1 text-gray-900 dark:text-white">{alert.description}</p>
              </div>

              {alert.instruction && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Instructions
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">{alert.instruction}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Category
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">{alert.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Severity
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">{alert.severity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Urgency
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">{alert.urgency}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Expires
                  </label>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {alert.expiresAt ? format(new Date(alert.expiresAt), "PPp") : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Areas */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Target Areas ({alert.targets.length})
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alert.targets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {target.locationName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {target.targetType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {target.estimatedRecipients.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">recipients</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Statistics */}
          {stats && alert.status !== AlertStatus.DRAFT && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Delivery Statistics
                </h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {stats.total}
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Delivered</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {stats.delivered}
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                      {stats.pending}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {stats.failed}
                    </p>
                  </div>
                </div>

                {stats.total > 0 && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>Delivery Progress</span>
                      <span>{stats.successRate.toFixed(1)}% success rate</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(stats.delivered / stats.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Timeline + Creator */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Timeline
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Created</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(alert.createdAt), "PPp")}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {alert.sentAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Sent</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(alert.sentAt), "PPp")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDistanceToNow(new Date(alert.sentAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}

              {alert.cancelledAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Cancelled</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(alert.cancelledAt), "PPp")}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDistanceToNow(new Date(alert.cancelledAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}

              {alert.updatedAt && alert.updatedAt !== alert.createdAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400 mt-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Last Updated
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(alert.updatedAt), "PPp")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Created By
              </h2>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {alert.createdBy.firstName} {alert.createdBy.lastName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {alert.createdBy.email}
                  </p>
                </div>
              </div>

              {alert.sentBy && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sent By
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.sentBy.firstName} {alert.sentBy.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {alert.sentBy.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {alert.cancelledBy && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cancelled By
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                      <UserX className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.cancelledBy.firstName} {alert.cancelledBy.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {alert.cancelledBy.email}
                      </p>
                    </div>
                  </div>
                  {alert.cancelReason && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                      "{alert.cancelReason}"
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Preview Modal ──────────────────────────────────────────────────────── */}
      {showPreviewModal && preview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Alert Preview</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review how this alert will appear to recipients
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  SMS Message
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600 shadow-sm">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                    {preview.smsPreview.message}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{preview.smsPreview.characterCount} characters</span>
                  <span>{preview.smsPreview.messageCount} SMS segments</span>
                  <span className="font-medium">
                    Est. Cost: ₦{preview.smsPreview.estimatedCost.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Recipients</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {preview.estimatedRecipients.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Target Areas</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {preview.targets.length}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Coverage Areas
                </h3>
                <div className="space-y-2">
                  {preview.targets.map((target) => (
                    <div
                      key={target.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">
                        {target.locationName}
                      </span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {target.estimatedRecipients.toLocaleString()} recipients
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPreviewModal(false)}
                >
                  Close
                </Button>
                {canSend && (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setShowPreviewModal(false);
                      setShowSendModal(true);
                    }}
                  >
                    {alert.status === AlertStatus.FAILED ? "Retry Send" : "Proceed to Send"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Send Modal ────────────────────────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {alert.status === AlertStatus.FAILED ? "Retry Send Alert" : "Send Alert"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enter your 2FA code to confirm sending this alert to{" "}
                {preview?.estimatedRecipients.toLocaleString() || "all"} recipients.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {alert.status === AlertStatus.FAILED && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ This alert previously failed. Make sure to review the alert details before
                    retrying.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  2FA Code
                </label>

                {isInitiatingOTP && twoFactorMethod === "EMAIL" ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending verification code to your email…
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoFocus={!isInitiatingOTP}
                  />
                )}

                {!isInitiatingOTP && getTwoFactorHint()}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSendModal(false);
                    setTwoFactorCode("");
                  }}
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSend}
                  disabled={
                    !twoFactorCode ||
                    twoFactorCode.length < 6 ||
                    isSending ||
                    isInitiatingOTP
                  }
                  isLoading={isSending}
                >
                  Confirm {alert.status === AlertStatus.FAILED ? "Retry" : "Send"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Cancel Modal ──────────────────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Cancel {alert.status === AlertStatus.DRAFT ? "Draft" : "Alert"}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {alert.status === AlertStatus.DRAFT
                  ? "This will cancel the draft preventing it from being sent."
                  : `This will stop the alert distribution.${
                      stats && stats.delivered > 0
                        ? ` ${stats.delivered} messages have already been delivered.`
                        : ""
                    }`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={
                    alert.status === AlertStatus.DRAFT
                      ? "Why is this draft being cancelled?"
                      : "Why are you cancelling this alert?"
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  2FA Code
                </label>

                {isInitiatingOTP && twoFactorMethod === "EMAIL" ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending verification code to your email…
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                )}

                {!isInitiatingOTP && getTwoFactorHint()}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCancelModal(false);
                    setTwoFactorCode("");
                    setCancelReason("");
                  }}
                  disabled={isCancelling}
                >
                  Back
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleCancel}
                  disabled={
                    !twoFactorCode ||
                    !cancelReason ||
                    isCancelling ||
                    isInitiatingOTP
                  }
                  isLoading={isCancelling}
                >
                  Confirm Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}