import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Map as MapIcon,
  Building2,
  X,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  CircleDot,
  Eye,
  Send,
  Mail,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

// Hooks & Services
import { useCreateAlert, useEstimateRecipients, useSendAlert, useInitiateStepUpOTP } from "../hooks/";

// Components
import { Button } from "../../../components/ui/";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/";
import { Input } from "../../../components/ui/";
import { AdminAreaSelector } from "../components/create/";
import { GeoTargetMap } from "../components/create/";

// Types
import {
  AlertCategory,
  AlertSeverity,
  AlertUrgency,
  type CreateAlertRequest,
  type AlertTarget,
  TargetType,
} from "../types/";
import { useBFF } from "../../bff_auth/context";

export default function CreateAlertPage() {
  const navigate = useNavigate();

  // --- Auth (for 2FA method detection) ---
  const { user } = useBFF();
  const twoFactorMethod = user?.twoFactorMethod ?? "NONE"; // "EMAIL" | "GOOGLE_AUTHENTICATOR" | "NONE"
  const isTwoFactorEnabled = user?.isTwoFactorEnabled ?? false;

  // --- Mutations ---
  const { mutate: createAlert, isPending: isCreating } = useCreateAlert();
  const { mutate: sendAlert, isPending: isSending } = useSendAlert();
  const { mutate: estimateRecipients, isPending: isEstimating, data: estimateData, reset: resetEstimate } = useEstimateRecipients();
  const { mutate: initiateOTP, isPending: isInitiatingOTP } = useInitiateStepUpOTP();

  // --- State ---
  const [activeTab, setActiveTab] = useState<"admin" | "map">("admin");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [createdAlertId, setCreatedAlertId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"preview-only" | "send-flow">("preview-only");
  const [otpSent, setOtpSent] = useState(false);

  const [formData, setFormData] = useState<CreateAlertRequest>({
    headline: "",
    description: "",
    instruction: "",
    category: AlertCategory.OTHER,
    severity: AlertSeverity.MODERATE,
    urgency: AlertUrgency.EXPECTED,
    expiresAt: "",
    targets: [],
  });

  // --- Effects ---
  useEffect(() => {
    if (formData.targets.length > 0) {
      const timer = setTimeout(() => {
        estimateRecipients(formData.targets);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      resetEstimate();
    }
  }, [formData.targets, estimateRecipients, resetEstimate]);

  // When the send modal opens and user has Email 2FA, fire the OTP immediately
  useEffect(() => {
    if (showSendModal && isTwoFactorEnabled && twoFactorMethod === "EMAIL" && !otpSent) {
      initiateOTP(undefined, {
        onSuccess: () => setOtpSent(true),
        onError: () => setOtpSent(true), // mark as attempted even on failure
      });
    }
  }, [showSendModal, isTwoFactorEnabled, twoFactorMethod, otpSent, initiateOTP]);

  // Reset otpSent when modal closes
  useEffect(() => {
    if (!showSendModal) {
      setOtpSent(false);
    }
  }, [showSendModal]);

  // --- Validation ---
  const isFormValid = () =>
    formData.headline.trim().length > 0 &&
    formData.description.trim().length > 0 &&
    formData.targets.length > 0 &&
    estimateData?.data?.estimatedRecipients !== undefined;

  const isBasicFormValid = () =>
    formData.headline.trim().length > 0 &&
    formData.description.trim().length > 0 &&
    formData.targets.length > 0;

  // --- Helpers ---
  const formatDateForInput = (isoString: string) => {
    if (!isoString) return undefined;
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
  };

  const getSanitizedPayload = (): CreateAlertRequest => ({
    ...formData,
    expiresAt: formData.expiresAt ? formData.expiresAt : undefined,
  });

  /** Returns the hint text shown below the 2FA code input */
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
    return (
      <p className="text-xs text-gray-500 mt-1">Enter your 2FA verification code.</p>
    );
  };

  // --- Handlers ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const localValue = e.target.value;
    if (!localValue) {
      setFormData((prev) => ({ ...prev, expiresAt: undefined }));
      return;
    }
    setFormData((prev) => ({ ...prev, expiresAt: new Date(localValue).toISOString() }));
  };

  const handleAddTarget = (target: AlertTarget) => {
    const exists = formData.targets.some((t) => {
      if (t.targetType !== target.targetType) return false;
      switch (t.targetType) {
        case TargetType.STATE: return t.stateId === target.stateId;
        case TargetType.LGA:   return t.lgaId === target.lgaId;
        case TargetType.WARD:  return t.wardId === target.wardId;
        default:               return false;
      }
    });

    if (exists) {
      toast.info("Target already selected");
      return;
    }

    setFormData((prev) => ({ ...prev, targets: [...prev.targets, target] }));
    toast.success(`${target.locationName || "Target"} added`);
  };

  const handleRemoveTarget = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      targets: prev.targets.filter((_, i) => i !== index),
    }));
  };

  const handleSaveDraft = () => {
    if (!formData.headline || !formData.description) {
      toast.error("Please fill in the headline and description");
      return;
    }
    if (formData.targets.length === 0) {
      toast.error("Please select at least one target area");
      return;
    }
    createAlert(getSanitizedPayload(), {
      onSuccess: (response) => {
        toast.success("Alert saved as draft");
        navigate(`/alerts/${response.data!.id}`);
      },
      onError: (error: any) => {
        toast.error("Failed to save draft", {
          description: error?.response?.data?.message || "An error occurred.",
        });
      },
    });
  };

  const handlePreviewOnly = () => {
    if (!isBasicFormValid()) {
      toast.error("Please complete headline, description, and select at least one target");
      return;
    }
    setPreviewMode("preview-only");
    setShowPreviewModal(true);
  };

  const handleSendAlert = () => {
    if (!isFormValid()) {
      toast.error("Please complete all required fields and wait for recipient estimation");
      return;
    }
    setPreviewMode("send-flow");
    setShowPreviewModal(true);
  };

  const handleProceedToSend = () => {
    createAlert(getSanitizedPayload(), {
      onSuccess: (response) => {
        setCreatedAlertId(response.data!.id);
        setShowPreviewModal(false);
        setShowSendModal(true); // useEffect above will trigger OTP email
      },
      onError: (error: any) => {
        toast.error("Failed to create alert", {
          description: error?.response?.data?.message || "An error occurred.",
        });
      },
    });
  };

  const handleConfirmSend = () => {
    if (!createdAlertId || !twoFactorCode) {
      toast.error("Please enter your 2FA code");
      return;
    }

    sendAlert(
      { id: createdAlertId, code: twoFactorCode },
      {
        onSuccess: () => {
          setShowSendModal(false);
          setTwoFactorCode("");
          navigate(`/alerts/${createdAlertId}`);
        },
        onError: (error: any) => {
          toast.error("Failed to send alert", {
            description: error?.response?.data?.message || "You can retry from the alert detail page.",
          });
          navigate(`/alerts/${createdAlertId}`);
        },
      }
    );
  };

  // SMS preview helpers
  const smsPreview = `${formData.headline}\n\n${formData.description}${formData.instruction ? `\n\n${formData.instruction}` : ""}`;
  const smsLength = smsPreview.length;
  const smsCount = Math.ceil(smsLength / 160);
  const estimatedCost = (estimateData?.data?.estimatedRecipients || 0) * smsCount * 2.5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate("/alerts")}
          >
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">Create New Alert</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Fill in the details to create an emergency alert
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handlePreviewOnly}
            disabled={!isBasicFormValid() || isCreating}
            leftIcon={<Eye className="w-4 h-4" />}
          >
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!isBasicFormValid() || isCreating}
            isLoading={isCreating && !createdAlertId}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Draft
          </Button>
          <Button
            variant="default"
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            onClick={handleSendAlert}
            disabled={!isFormValid() || isCreating}
            isLoading={isCreating && !!createdAlertId}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Send Alert
          </Button>
        </div>
      </div>

      {/* Progress Indicator */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 ${
                  formData.headline && formData.description ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {formData.headline && formData.description ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <CircleDot className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">Alert Info</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  formData.targets.length > 0 ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {formData.targets.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <CircleDot className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">Targets</span>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  estimateData?.data?.estimatedRecipients ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {estimateData?.data?.estimatedRecipients ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <CircleDot className="w-5 h-5" />
                )}
                <span className="text-sm font-medium">Recipients</span>
              </div>
            </div>
            {isFormValid() && (
              <span className="text-sm font-medium text-emerald-600">Ready to send ✓</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column – Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alert Information */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Information</CardTitle>
              <CardDescription>Provide the basic details of the emergency alert</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Headline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Headline <span className="text-red-500">*</span>
                </label>
                <Input
                  name="headline"
                  value={formData.headline}
                  onChange={handleInputChange}
                  placeholder="e.g., Flash Flood Warning"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.headline.length}/100 characters</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the emergency situation in detail..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.description.length}/500 characters
                </p>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instructions (Optional)
                </label>
                <textarea
                  name="instruction"
                  value={formData.instruction}
                  onChange={handleInputChange}
                  placeholder="What should people do? e.g., Move to higher ground immediately..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.instruction?.length || 0}/300 characters
                </p>
              </div>

              {/* Category / Severity / Urgency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={AlertCategory.WEATHER}>Weather</option>
                    <option value={AlertCategory.GEO}>Geological</option>
                    <option value={AlertCategory.MET}>Meteorological</option>
                    <option value={AlertCategory.SAFETY}>Public Safety</option>
                    <option value={AlertCategory.SECURITY}>Security</option>
                    <option value={AlertCategory.RESCUE}>Rescue</option>
                    <option value={AlertCategory.HEALTH}>Health</option>
                    <option value={AlertCategory.FIRE}>Fire</option>
                    <option value={AlertCategory.TRANSPORT}>Transport</option>
                    <option value={AlertCategory.ENVIRONMENTAL}>Environmental</option>
                    <option value={AlertCategory.INFRASTRUCTURE}>Infrastructure</option>
                    <option value={AlertCategory.CBRNE}>CBRNE</option>
                    <option value={AlertCategory.OTHER}>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Severity
                  </label>
                  <select
                    name="severity"
                    value={formData.severity}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={AlertSeverity.EXTREME}>🔴 Extreme</option>
                    <option value={AlertSeverity.SEVERE}>🟠 Severe</option>
                    <option value={AlertSeverity.MODERATE}>🟡 Moderate</option>
                    <option value={AlertSeverity.MINOR}>🟢 Minor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Urgency
                  </label>
                  <select
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={AlertUrgency.IMMEDIATE}>Immediate</option>
                    <option value={AlertUrgency.EXPECTED}>Expected</option>
                    <option value={AlertUrgency.FUTURE}>Future</option>
                    <option value={AlertUrgency.PAST}>Past</option>
                  </select>
                </div>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiration Date (Optional)
                </label>
                <Input
                  type="datetime-local"
                  value={formatDateForInput(formData.expiresAt as string)}
                  onChange={handleDateChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  When should this alert expire? Leave empty for no expiration.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Target Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Target Areas</CardTitle>
                  <CardDescription>Select who should receive this alert</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === "admin" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("admin")}
                    leftIcon={<Building2 className="w-4 h-4" />}
                  >
                    Admin Areas
                  </Button>
                  <Button
                    variant={activeTab === "map" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("map")}
                    leftIcon={<MapIcon className="w-4 h-4" />}
                  >
                    Map
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === "admin" ? (
                <AdminAreaSelector onAddTarget={handleAddTarget} />
              ) : (
                <GeoTargetMap onTargetChange={handleAddTarget} />
              )}
            </CardContent>
          </Card>

          {/* Selected Targets */}
          {formData.targets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Targets ({formData.targets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {formData.targets.map((target, index) => (
                    <div
                      key={index}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTarget(index)}
                        leftIcon={<X className="w-4 h-4" />}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column – Summary */}
        <div className="space-y-6">
          {/* Recipient Estimate */}
          <Card>
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
            </CardHeader>
            <CardContent>
              {isEstimating ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : estimateData?.data?.estimatedRecipients ? (
                <div className="text-center">
                  <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                    {estimateData.data.estimatedRecipients.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Estimated recipients
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Add targets to see estimate</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Estimate */}
          {estimateData?.data?.estimatedRecipients && (
            <Card>
              <CardHeader>
                <CardTitle>Cost Estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">SMS Segments:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{smsCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Recipients:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {estimateData.data.estimatedRecipients.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-3 border-t border-gray-200 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                      ₦{estimatedCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SMS Preview */}
          <Card>
            <CardHeader>
              <CardTitle>SMS Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                  {smsPreview || "Your message will appear here..."}
                </p>
              </div>
              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>{smsLength} characters</span>
                <span>{smsCount} SMS</span>
              </div>
            </CardContent>
          </Card>

          {/* Extreme severity warning */}
          {formData.severity === AlertSeverity.EXTREME && (
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                      Critical Alert
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      This is an EXTREME severity alert. Please ensure all details are accurate.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Alert Preview</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review your alert before {previewMode === "send-flow" ? "sending" : "saving"}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Details */}
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Headline:</span>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {formData.headline}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Description:</span>
                  <p className="text-gray-900 dark:text-white">{formData.description}</p>
                </div>
                {formData.instruction && (
                  <div>
                    <span className="text-sm text-gray-500">Instructions:</span>
                    <p className="text-gray-900 dark:text-white">{formData.instruction}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-sm text-gray-500">Category:</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formData.category}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Severity:</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formData.severity}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Urgency:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formData.urgency}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Expires:</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formData.expiresAt
                        ? new Date(formData.expiresAt).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              </div>

              {/* SMS Preview */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  SMS Message
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600 shadow-sm">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                    {smsPreview}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{smsLength} characters</span>
                  <span>{smsCount} SMS segments</span>
                  <span className="font-medium">Est. Cost: ₦{estimatedCost.toLocaleString()}</span>
                </div>
              </div>

              {/* Recipients */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Recipients</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {estimateData?.data?.estimatedRecipients?.toLocaleString() || "0"}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Target Areas</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {formData.targets.length}
                  </p>
                </div>
              </div>

              {/* Target list */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Coverage Areas
                </h3>
                <div className="space-y-2">
                  {formData.targets.map((target, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">
                        {target.locationName}
                      </span>
                      <span className="text-xs text-gray-500">{target.targetType}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* High cost warning */}
              {estimatedCost > 10000 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        High Cost Alert
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        This alert will cost approximately ₦{estimatedCost.toLocaleString()}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewMode("preview-only");
                  }}
                >
                  {previewMode === "send-flow" ? "Back to Edit" : "Close"}
                </Button>
                {previewMode === "preview-only" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPreviewModal(false);
                      handleSaveDraft();
                    }}
                    className="flex-1"
                    leftIcon={<Save className="w-4 h-4" />}
                    disabled={isCreating}
                  >
                    Save Draft
                  </Button>
                ) : null}
                {previewMode === "send-flow" && (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleProceedToSend}
                    leftIcon={<Send className="w-4 h-4" />}
                    disabled={isCreating}
                    isLoading={isCreating}
                  >
                    Proceed to Send
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Send Confirmation Modal ── */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Confirm Alert Dispatch
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enter your 2FA code to send this alert to{" "}
                {estimateData?.data?.estimatedRecipients?.toLocaleString() || "all"} recipients.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Recipients:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {estimateData?.data?.estimatedRecipients?.toLocaleString() || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">SMS Cost:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₦{estimatedCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Severity:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formData.severity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extreme warning */}
              {formData.severity === AlertSeverity.EXTREME && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                        Critical Alert
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        You are about to send an EXTREME severity alert. Ensure all details are
                        accurate before proceeding.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2FA Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  2FA Verification Code
                </label>

                {/* Loading spinner while OTP email is being dispatched */}
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
                    className="text-center text-lg tracking-widest font-mono"
                  />
                )}

                {/* Context-aware hint */}
                {!isInitiatingOTP && getTwoFactorHint()}
              </div>

              {/* Confirmation checkbox */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={true} readOnly />
                  <span className="text-gray-700 dark:text-gray-300">
                    I confirm that I have reviewed all details and understand that this alert will
                    be sent immediately to all targeted recipients.
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSendModal(false);
                    setTwoFactorCode("");
                    if (createdAlertId) navigate(`/alerts/${createdAlertId}`);
                  }}
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleConfirmSend}
                  disabled={
                    !twoFactorCode ||
                    twoFactorCode.length < 6 ||
                    isSending ||
                    isInitiatingOTP
                  }
                  isLoading={isSending}
                >
                  {isSending ? "Sending…" : "Confirm & Send"}
                </Button>
              </div>

              <p className="text-xs text-center text-gray-500">
                If you cancel now, the alert will be saved as a draft and can be sent later.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}