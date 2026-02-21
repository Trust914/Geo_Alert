import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Building2, Users, Bell, Eye, Edit, TrendingUp, Shield, MapPin, Activity } from "lucide-react";
import { useAgencies, useAgencyStats } from "../hooks/";
import { AgencyStatus, AgencyType, JurisdictionLevel, type IAgencyFilters } from "../types/";
import clsx from "clsx";

export default function AgencyManagementPage() {
  const navigate = useNavigate();

  // State for filters
  const [filters, setFilters] = useState<IAgencyFilters>({
    status: AgencyStatus.ACTIVE,
    currentPage: 1,
    limit: 20,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Queries
  const { data: agenciesData, isLoading } = useAgencies(filters);
  const { data: statsData } = useAgencyStats();

  const agencies = agenciesData?.data || [];
  const pagination = agenciesData?.pagination;
  const stats = statsData?.data;

  // Handle search with debounce
  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, currentPage: 1 });
  };

  const handleFilterChange = (key: keyof IAgencyFilters, value: any) => {
    setFilters({ ...filters, [key]: value, currentPage: 1 });
  };

  const clearFilters = () => {
    setFilters({ status: AgencyStatus.ACTIVE, currentPage: 1, limit: 20 });
    setSearchTerm("");
  };

  const getStatusBadge = (status: AgencyStatus) => {
    const styles = {
      ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
      SUSPENDED: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
      INACTIVE: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
    };
    return styles[status] || styles.INACTIVE;
  };

  const getTypeBadge = (type: AgencyType) => {
    const styles = {
      FEDERAL: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
      STATE: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
      LOCAL: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
      SECURITY: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
      HEALTH: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
      EMERGENCY: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
    };
    return styles[type as keyof typeof styles] || "";
  };

  // Stats cards data
  const statsCards = [
    {
      name: "Total Agencies",
      value: stats?.total || 0,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      border: "border-blue-100 dark:border-blue-500/20",
    },
    {
      name: "Active",
      value: stats?.active || 0,
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-100 dark:border-emerald-500/20",
    },
    {
      name: "Suspended",
      value: stats?.suspended || 0,
      icon: Shield,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-100 dark:border-amber-500/20",
    },
    {
      name: "Inactive",
      value: stats?.inactive || 0,
      icon: TrendingUp,
      color: "text-gray-600",
      bg: "bg-gray-50 dark:bg-gray-500/10",
      border: "border-gray-100 dark:border-gray-500/20",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Agency Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage government agencies and their access</p>
        </div>
        <button onClick={() => navigate("/agencies/create")} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all">
          <Plus className="w-5 h-5" />
          Create Agency
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <div key={stat.name} className={clsx("relative overflow-hidden rounded-2xl p-6 border transition-all duration-200", "bg-white dark:bg-gray-900", stat.border)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
              </div>
              <div className={clsx("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={clsx("w-6 h-6", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search agencies by name, email, phone, or jurisdiction..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSearch} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all">
              Search
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={clsx("px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2", showFilters ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300")}>
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agency Type</label>
              <select value={filters.type || ""} onChange={(e) => handleFilterChange("type", e.target.value || undefined)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                <option value="">All Types</option>
                <option value={AgencyType.FEDERAL}>Federal</option>
                <option value={AgencyType.STATE}>State</option>
                <option value={AgencyType.LOCAL}>Local</option>
                <option value={AgencyType.SECURITY}>Security</option>
                <option value={AgencyType.HEALTH}>Health</option>
                <option value={AgencyType.EMERGENCY}>Emergency</option>
              </select>
            </div>

            {/* Jurisdiction Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jurisdiction Level</label>
              <select value={filters.jurisdictionLevel || ""} onChange={(e) => handleFilterChange("jurisdictionLevel", e.target.value || undefined)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                <option value="">All Levels</option>
                <option value={JurisdictionLevel.NATIONAL}>National</option>
                <option value={JurisdictionLevel.STATE}>State</option>
                <option value={JurisdictionLevel.LGA}>LGA</option>
                <option value={JurisdictionLevel.WARD}>Ward</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select value={filters.status || ""} onChange={(e) => handleFilterChange("status", e.target.value || undefined)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
                <option value="">All Statuses</option>
                <option value={AgencyStatus.ACTIVE}>Active</option>
                <option value={AgencyStatus.SUSPENDED}>Suspended</option>
                <option value={AgencyStatus.INACTIVE}>Inactive</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="md:col-span-3 flex justify-end">
              <button onClick={clearFilters} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium">
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Agencies Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agencies...</p>
          </div>
        ) : agencies.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">No agencies found</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Try adjusting your filters or create a new agency</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Agency</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Jurisdiction</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Users</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Alerts</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {agencies.map((agency) => (
                    <tr key={agency.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{agency.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{agency.contactEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx("inline-flex px-3 py-1 rounded-full text-xs font-semibold", getTypeBadge(agency.type))}>{agency.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">{agency.jurisdiction}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{agency.jurisdictionLevel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx("inline-flex px-3 py-1 rounded-full text-xs font-semibold", getStatusBadge(agency.status))}>{agency.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{agency._count?.users || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{agency._count?.alerts || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => navigate(`/agencies/${agency.id}`)} className="p-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => navigate(`/agencies/${agency.id}/edit`)} className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Edit Agency">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.total} total agencies)
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleFilterChange("currentPage", pagination.currentPage - 1)} disabled={!pagination.hasPrev} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    Previous
                  </button>
                  <button onClick={() => handleFilterChange("currentPage", pagination.currentPage + 1)} disabled={!pagination.hasNext} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
