import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, User, Mail, Phone, MapPin, Shield, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { useCreateAgency } from "../hooks/";
import { AgencyType, JurisdictionLevel, type ICreateAgencyDTO } from "../types/agency.types";
import clsx from "clsx";

type Step = 1 | 2 | 3;

export default function CreateAgencyPage() {
  const navigate = useNavigate();
  const createMutation = useCreateAgency();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<ICreateAgencyDTO>({
    name: "",
    type: AgencyType.FEDERAL,
    jurisdiction: "",
    jurisdictionLevel: JurisdictionLevel.NATIONAL,
    contactEmail: "",
    contactPhone: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ICreateAgencyDTO, string>>>({});

  // Jurisdiction validation rules
  const jurisdictionRules: Record<AgencyType, JurisdictionLevel[]> = {
    [AgencyType.FEDERAL]: [JurisdictionLevel.NATIONAL],
    [AgencyType.STATE]: [JurisdictionLevel.STATE],
    [AgencyType.LOCAL]: [JurisdictionLevel.LGA, JurisdictionLevel.WARD],
    [AgencyType.SECURITY]: [JurisdictionLevel.NATIONAL, JurisdictionLevel.STATE, JurisdictionLevel.LGA, JurisdictionLevel.WARD],
    [AgencyType.HEALTH]: [JurisdictionLevel.NATIONAL, JurisdictionLevel.STATE, JurisdictionLevel.LGA, JurisdictionLevel.WARD],
    [AgencyType.EMERGENCY]: [JurisdictionLevel.NATIONAL, JurisdictionLevel.STATE, JurisdictionLevel.LGA, JurisdictionLevel.WARD],
  };

  const handleInputChange = (field: keyof ICreateAgencyDTO, value: string) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const handleTypeChange = (type: AgencyType) => {
    const allowedLevels = jurisdictionRules[type];
    setFormData({
      ...formData,
      type,
      jurisdictionLevel: allowedLevels[0], // Auto-select first valid level
    });
  };

  const validateStep = (step: Step): boolean => {
    const newErrors: Partial<Record<keyof ICreateAgencyDTO, string>> = {};

    if (step === 1) {
      if (!formData.name || formData.name.length < 3) {
        newErrors.name = "Agency name must be at least 3 characters";
      }
      if (!formData.jurisdiction || formData.jurisdiction.length < 3) {
        newErrors.jurisdiction = "Jurisdiction must be at least 3 characters";
      }
    }

    if (step === 2) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.contactEmail || !emailRegex.test(formData.contactEmail)) {
        newErrors.contactEmail = "Please enter a valid email address";
      }
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!formData.contactPhone || !phoneRegex.test(formData.contactPhone)) {
        newErrors.contactPhone = "Please enter a valid phone number";
      }
    }

    if (step === 3) {
      if (!formData.adminFirstName || formData.adminFirstName.length < 2) {
        newErrors.adminFirstName = "First name must be at least 2 characters";
      }
      if (!formData.adminLastName || formData.adminLastName.length < 2) {
        newErrors.adminLastName = "Last name must be at least 2 characters";
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.adminEmail || !emailRegex.test(formData.adminEmail)) {
        newErrors.adminEmail = "Please enter a valid email address";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const prevStep = () => {
    setCurrentStep((currentStep - 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    createMutation.mutate(formData, {
      onSuccess: () => {
        navigate("/agencies");
      },
    });
  };

  const steps = [
    { number: 1, title: "Agency Details", icon: Building2 },
    { number: 2, title: "Contact Information", icon: Phone },
    { number: 3, title: "Administrator", icon: User },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/agencies")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Create New Agency</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Add a new agency to the GEOALERT system</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all", currentStep >= step.number ? "bg-emerald-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400")}>
                  {currentStep > step.number ? <CheckCircle2 className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
                </div>
                <p className={clsx("text-sm font-medium mt-2 text-center", currentStep >= step.number ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400")}>{step.title}</p>
              </div>
              {index < steps.length - 1 && <div className={clsx("h-1 flex-1 mx-4 rounded transition-all", currentStep > step.number ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700")} />}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 space-y-6">
        {/* Step 1: Agency Details */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-600" />
              Agency Details
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Agency Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Federal Emergency Management Agency"
                className={clsx(
                  "w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                  errors.name ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                )}
              />
              {errors.name && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Agency Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value as AgencyType)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  <option value={AgencyType.FEDERAL}>Federal</option>
                  <option value={AgencyType.STATE}>State</option>
                  <option value={AgencyType.LOCAL}>Local</option>
                  <option value={AgencyType.SECURITY}>Security</option>
                  <option value={AgencyType.HEALTH}>Health</option>
                  <option value={AgencyType.EMERGENCY}>Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Jurisdiction Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.jurisdictionLevel}
                  onChange={(e) => handleInputChange("jurisdictionLevel", e.target.value as JurisdictionLevel)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  {jurisdictionRules[formData.type].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Jurisdiction <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.jurisdiction}
                  onChange={(e) => handleInputChange("jurisdiction", e.target.value)}
                  placeholder="e.g., Nigeria, Lagos State, Ikeja LGA"
                  className={clsx(
                    "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                    errors.jurisdiction ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                  )}
                />
              </div>
              {errors.jurisdiction && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.jurisdiction}</p>}
            </div>
          </div>
        )}

        {/* Step 2: Contact Information */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="w-6 h-6 text-emerald-600" />
              Contact Information
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Contact Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  placeholder="contact@agency.gov.ng"
                  className={clsx(
                    "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                    errors.contactEmail ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                  )}
                />
              </div>
              {errors.contactEmail && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.contactEmail}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Contact Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                  placeholder="+2348012345678"
                  className={clsx(
                    "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                    errors.contactPhone ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                  )}
                />
              </div>
              {errors.contactPhone && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.contactPhone}</p>}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Use international format (e.g., +234...)</p>
            </div>
          </div>
        )}

        {/* Step 3: Administrator */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-600" />
              Administrator Account
            </h2>

            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400">An admin account will be created for this agency. The admin will receive an activation email to set their password.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.adminFirstName}
                  onChange={(e) => handleInputChange("adminFirstName", e.target.value)}
                  placeholder="John"
                  className={clsx(
                    "w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                    errors.adminFirstName ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                  )}
                />
                {errors.adminFirstName && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.adminFirstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.adminLastName}
                  onChange={(e) => handleInputChange("adminLastName", e.target.value)}
                  placeholder="Doe"
                  className={clsx(
                    "w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                    errors.adminLastName ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                  )}
                />
                {errors.adminLastName && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.adminLastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => handleInputChange("adminEmail", e.target.value)}
                  placeholder="admin@agency.gov.ng"
                  className={clsx(
                    "w-full pl-12 pr-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 transition-all",
                    errors.adminEmail ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-emerald-500",
                  )}
                />
              </div>
              {errors.adminEmail && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.adminEmail}</p>}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={prevStep}
              disabled={createMutation.isPending}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              Previous
            </button>
          )}

          {currentStep < 3 ? (
            <button type="button" onClick={nextStep} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all">
              Next Step
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button type="submit" disabled={createMutation.isPending} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Agency...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Create Agency
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
