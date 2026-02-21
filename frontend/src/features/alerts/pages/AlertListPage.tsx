import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Filter, Download, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useAlerts } from "../hooks/useAlerts";

import { Button } from "../../../components/ui/";
import { Card } from "../../../components/ui/";
import type { AlertFilters } from "../types/";
import { AlertCard } from "../components/";
import { AlertFiltersPanel } from "../components/";


const generatePagination = (currentPage: number, totalPages: number) => {
  // If 7 or fewer pages, show all
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // Logic to show First, Last, and Neighbors of Current
  const pages: (number | string)[] = [1];

  if (currentPage > 3) {
    pages.push("...");
  }

  // Calculate range around current page
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
};

export default function AlertListPage() {
  // CRITICAL FIX: Sort by updatedAt (DESC) to show recently updated alerts at the top
  const [filters, setFilters] = useState<AlertFilters>({
    currentPage: 1,
    limit: 20,
    sortBy: "updatedAt",
    sortOrder: "desc",
  } as AlertFilters);

  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useAlerts(filters);

  const handleFilterChange = (newFilters: Partial<AlertFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      currentPage: 1, // Reset to page 1 on filter change
    }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || (data?.pagination && page > data.pagination.totalPages)) return;

    setFilters((prev) => ({ ...prev, currentPage: page }));

    // Smooth scroll to top of list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading alerts...</p>
        </div>
      </div>
    );
  }

  const alerts = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">
            Alert Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create and manage emergency alerts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            onClick={() => refetch()}
            isLoading={isRefetching}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>

          <Link to="/alerts/create">
            <Button
              size="default"
              className="bg-gradient-to-r from-emerald-500 to-green-600"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Alert
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards (Optional - included for completeness) */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* ... (Stats cards code from previous steps remains here) ... */}
         <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Alerts
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {pagination?.total || 0}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-xl">📢</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="w-4 h-4" />}
          >
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
          <Button variant="ghost" leftIcon={<Download className="w-4 h-4" />}>
            Export
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <AlertFiltersPanel filters={filters} onFilterChange={handleFilterChange} />
          </div>
        )}
      </Card>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <Card className="p-12 text-center">
           {/* Empty state content */}
           <p className="text-gray-500">No alerts found.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* --- EFFICIENT PAGINATION IMPLEMENTATION --- */}
      {pagination && pagination.totalPages > 1 && (
        <Card className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

            {/* 1. Showing X-Y of Z text */}
            <div className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
              Showing <span className="font-medium">{(pagination.currentPage - 1) * pagination.limit + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(pagination.currentPage * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span> results
            </div>

            {/* 2. Pagination Controls */}
            <div className="flex items-center gap-1 order-1 sm:order-2">

              {/* Previous Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrev}
                className="h-8 w-8 p-0"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Page Numbers Generated Efficiently */}
              <div className="flex items-center gap-1">
                {generatePagination(pagination.currentPage, pagination.totalPages).map((page, idx) => (
                  <div key={idx}>
                    {page === "..." ? (
                      <span className="px-2 text-gray-400 text-xs">•••</span>
                    ) : (
                      <Button
                        variant={page === pagination.currentPage ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handlePageChange(page as number)}
                        className={`h-8 w-8 p-0 text-xs font-medium ${
                          page === pagination.currentPage
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                      >
                        {page}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Next Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNext}
                className="h-8 w-8 p-0"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}