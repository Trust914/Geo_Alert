import { Building2, MapPin, Mail, Phone, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import type { IAgency } from "../types";

interface AgencyInfoSectionProps {
  agency: IAgency;
}

export function AgencyInfoSection({ agency }: AgencyInfoSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <Building2 className="w-6 h-6 text-emerald-600" />
        Agency Information
      </h2>

      <div className="space-y-4">
        <InfoCard
          icon={<Building2 className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
          label="Agency Type"
          value={agency.type}
        />

        <InfoCard
          icon={<MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
          label="Jurisdiction"
          value={agency.jurisdiction}
          subtitle={`Level: ${agency.jurisdictionLevel}`}
        />

        <InfoCard
          icon={<Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
          label="Contact Email"
          value={
            <a
              href={`mailto:${agency.contactEmail}`}
              className="text-base font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {agency.contactEmail}
            </a>
          }
        />

        <InfoCard
          icon={<Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
          label="Contact Phone"
          value={
            <a
              href={`tel:${agency.contactPhone}`}
              className="text-base font-semibold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {agency.contactPhone}
            </a>
          }
        />

        <InfoCard
          icon={<Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
          label="Created On"
          value={format(new Date(agency.createdAt), "MMMM dd, yyyy")}
        />

        <InfoCard
          icon={<Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />}
          label="Last Updated"
          value={format(new Date(agency.updatedAt), "MMMM dd, yyyy 'at' h:mm a")}
        />
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode | string;
  subtitle?: string;
}

function InfoCard({ icon, label, value, subtitle }: InfoCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
      {icon}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className="text-base font-semibold text-gray-900 dark:text-white mt-1">
          {value}
        </div>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}