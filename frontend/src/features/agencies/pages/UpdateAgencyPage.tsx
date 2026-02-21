import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Building2, Mail, Phone, MapPin, Shield, Info } from "lucide-react";
import { useAgencyById, useUpdateAgency } from "../hooks/";
import type { IUpdateAgencyDTO } from "../types/";
import { AgencyStatus } from "../types/";
import clsx from "clsx";

export default function UpdateAgencyPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const navigate = useNavigate();

  const { data, isLoading: isLoadingAgency } = useAgencyById(agencyId || null);
  const updateMutation = useUpdateAgency();

  const agency = data?.data;

  const [formData, setFormData] = useState<IUpdateAgencyDTO>({
    name: "",
    jurisdiction: "",
    contactEmail: "",
    contactPhone: "",
    status: AgencyStatus.ACTIVE,
  });

  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof IUpdateAgencyDTO, string>>>({});

  useEffect(() => {
    if (agency) {
      setFormData({
        name: agency.name,
        jurisdiction: agency.jurisdiction,
        contactEmail: agency.contactEmail,
        contactPhone: agency.contactPhone,
        status: agency.status,
      });
    }
  }, [agency]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof IUpdateAgencyDTO, string>> = {};

    if (formData.name && formData.name.length < 3) {
      newErrors.name = "Agency name must be at least 3 characters";
    }

    if (formData.jurisdiction && formData.jurisdiction.length < 3) {
      newErrors.jurisdiction = "Jurisdiction must be at least 3 characters";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.contactEmail && !emailRegex.test(formData.contactEmail)) {
      newErrors.contactEmail = "Please enter a valid email address";
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (formData.contactPhone && !phoneRegex.test(formData.contactPhone)) {
      newErrors.contactPhone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !agencyId) return;

    updateMutation.mutate(
      {
        agencyId,
        data: formData,
        twoFactorCode: twoFactorCode || undefined,
      },
      {
        onSuccess: () => {
          navigate(`/agencies/${agencyId}`);
        },
      },
    );
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (isLoadingAgency) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading agency details...</p>
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg">Agency not found</p>
          <button onClick={() => navigate("/agencies")} className="mt-4 text-emerald-600 hover:text-emerald-700">
            Return to Agency Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Edit Agency</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Update information for {agency.name}</p>
        </div>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">2FA Required for Updates</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400">Updating core agency details requires two-factor authentication. If you have 2FA enabled, enter your verification code below before submitting.</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
        {/* Read-Only Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Agency Information (Read-Only)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Agency Type</label>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{agency.type}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cannot be changed</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Jurisdiction Level</label>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{agency.jurisdictionLevel}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cannot be changed</p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editable Information</h3>

          {/* Agency Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Agency Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={clsx(
                "w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                errors.name ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
              )}
              placeholder="Enter agency name"
            />
            {errors.name && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
          </div>

          {/* Jurisdiction */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Jurisdiction</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                className={clsx(
                  "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                  errors.jurisdiction ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                )}
                placeholder="Enter jurisdiction"
              />
            </div>
            {errors.jurisdiction && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.jurisdiction}</p>}
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contact Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className={clsx(
                  "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                  errors.contactEmail ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                )}
                placeholder="Enter contact email"
              />
            </div>
            {errors.contactEmail && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.contactEmail}</p>}
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contact Phone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className={clsx(
                  "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                  errors.contactPhone ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                )}
                placeholder="+2348012345678"
              />
            </div>
            {errors.contactPhone && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.contactPhone}</p>}
          </div>
        </div>

        {/* Status Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Agency Status</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: AgencyStatus.ACTIVE })}
              className={clsx("p-4 rounded-xl border-2 transition-all text-left", formData.status === AgencyStatus.ACTIVE ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600")}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center", formData.status === AgencyStatus.ACTIVE ? "border-emerald-500 bg-emerald-500" : "border-gray-300 dark:border-gray-600")}>
                  {formData.status === AgencyStatus.ACTIVE && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Active</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Fully operational</p>
                </div>
              </div>
            </button>

            {/* Suspended */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: AgencyStatus.SUSPENDED })}
              className={clsx("p-4 rounded-xl border-2 transition-all text-left", formData.status === AgencyStatus.SUSPENDED ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600")}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center", formData.status === AgencyStatus.SUSPENDED ? "border-amber-500 bg-amber-500" : "border-gray-300 dark:border-gray-600")}>
                  {formData.status === AgencyStatus.SUSPENDED && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Suspended</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Temporarily disabled</p>
                </div>
              </div>
            </button>

            {/* Inactive */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: AgencyStatus.INACTIVE })}
              className={clsx("p-4 rounded-xl border-2 transition-all text-left", formData.status === AgencyStatus.INACTIVE ? "border-gray-500 bg-gray-50 dark:bg-gray-500/10" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600")}
            >
              <div className="flex items-center gap-3">
                <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center", formData.status === AgencyStatus.INACTIVE ? "border-gray-500 bg-gray-500" : "border-gray-300 dark:border-gray-600")}>
                  {formData.status === AgencyStatus.INACTIVE && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Inactive</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Deactivated</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 2FA Code */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </h3>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">2FA Code (if enabled)</label>
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="Enter your 2FA code"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">If you have 2FA enabled, you must provide your verification code to update the agency.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
