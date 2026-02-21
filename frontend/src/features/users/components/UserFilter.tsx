import { Search, X, SlidersHorizontal } from "lucide-react";
import type { IUserFilterProps } from "../types/";
import { UserRole } from "../../../types/enums.types";
import { useState, useCallback } from "react";
import clsx from "clsx";

// ---------------------------------------------------------------------------
// Static option lists for the select dropdowns
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { label: string; value: UserRole | "" }[] = [
  { label: "All Roles", value: "" },
  { label: "Viewer", value: UserRole.VIEWER },
  { label: "Operator", value: UserRole.OPERATOR },
  { label: "Coordinator", value: UserRole.COORDINATOR },
  { label: "Administrator", value: UserRole.ADMIN },
];

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "All Statuses", value: "" },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

export function UserFilter({ filters, onFilterChange, onReset }: IUserFilterProps) {
  const [showPanel, setShowPanel] = useState(false);
  // Local search value so we can debounce without firing on every keystroke
  const [localSearch, setLocalSearch] = useState(filters.search || "");

  // Debounce helper: we use a simple timeout ref via closure
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      // Clear any pending debounce
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      // Fire filter update after 300 ms of inactivity
      searchTimeoutRef.current = setTimeout(() => {
        onFilterChange({
          ...filters,
          search: value.trim() || undefined,
          currentPage: 1, // reset pagination when search changes
        });
      }, 300);
    },
    [filters, onFilterChange]
  );

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      role: (e.target.value as UserRole) || undefined,
      currentPage: 1,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterChange({
      ...filters,
      isActive: val === "" ? undefined : val === "true",
      currentPage: 1,
    });
  };

  const handleReset = () => {
    setLocalSearch("");
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    onReset();
  };

  // Count how many non-default filters are active
  const activeFilterCount = [
    filters.role !== undefined,
    filters.isActive !== undefined,
    filters.search !== undefined && filters.search !== "",
  ].filter(Boolean).length;

  // Shared select styling
  const selectClass = clsx(
    "w-full appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
    "text-gray-700 dark:text-gray-200 text-sm font-medium",
    "px-3 py-2.5 pr-8 rounded-lg",
    "focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500",
    "transition-colors cursor-pointer",
    // Custom arrow via background-image would be ideal but we use a wrapper approach instead
  );

  return (
    <div className="space-y-3">
      {/* ----------------------------------------------------------------- */}
      {/* Top toolbar: search + filter toggle                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or role…"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                onFilterChange({ ...filters, search: undefined, currentPage: 1 });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filter toggle button */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={clsx(
            "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
            showPanel
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-4.5 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Reset — only visible when filters are active */}
        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Collapsible filter panel: Role + Status dropdowns                  */}
      {/* ----------------------------------------------------------------- */}
      {showPanel && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Role dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Role
              </label>
              <div className="relative">
                <select
                  value={filters.role || ""}
                  onChange={handleRoleChange}
                  className={selectClass}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {/* Chevron icon — purely decorative, drawn via CSS would be cleaner
                    but an inline SVG keeps it framework-agnostic */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Status dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <div className="relative">
                <select
                  value={filters.isActive === undefined ? "" : String(filters.isActive)}
                  onChange={handleStatusChange}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Active filter summary pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              {filters.role && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">
                  Role: {filters.role.charAt(0).toUpperCase() + filters.role.slice(1).toLowerCase()}
                  <button
                    onClick={() => onFilterChange({ ...filters, role: undefined, currentPage: 1 })}
                    className="hover:text-gray-800 dark:hover:text-gray-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.isActive !== undefined && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">
                  Status: {filters.isActive ? "Active" : "Inactive"}
                  <button
                    onClick={() => onFilterChange({ ...filters, isActive: undefined, currentPage: 1 })}
                    className="hover:text-gray-800 dark:hover:text-gray-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.search && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">
                  Search: "{filters.search}"
                  <button
                    onClick={() => {
                      setLocalSearch("");
                      onFilterChange({ ...filters, search: undefined, currentPage: 1 });
                    }}
                    className="hover:text-gray-800 dark:hover:text-gray-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// We need React for useRef
import React from "react";