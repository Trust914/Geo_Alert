// src/components/CreateAlert/AdminAreaSelector.tsx
import { useState } from "react";
import { TargetType, type AlertTarget } from "../../types/alert.types";
import { useLGAs, useStates, useWards } from "../../hooks/useLocation";

interface AdminAreaSelectorProps {
  onAddTarget: (target: AlertTarget) => void;
}

export function AdminAreaSelector({ onAddTarget }: AdminAreaSelectorProps) {
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedLga, setSelectedLga] = useState<string>("");
  const [selectedWard, setSelectedWard] = useState<string>("");

  const { data: states, isLoading: loadingStates } = useStates();
  const { data: lgas, isLoading: loadingLgas } = useLGAs(selectedState);
  const { data: wards, isLoading: loadingWards } = useWards(selectedLga);

  const handleAdd = () => {
    let target: AlertTarget;

    // Determine the most specific target selected
    if (selectedWard) {
      const ward = wards?.find(w => w.id === selectedWard);
      target = { targetType: TargetType.WARD, wardId: selectedWard, locationName: ward?.name };
    } else if (selectedLga) {
      const lga = lgas?.find(l => l.id === selectedLga);
      target = { targetType: TargetType.LGA, lgaId: selectedLga, locationName: lga?.name };
    } else if (selectedState) {
      const st = states?.find(s => s.id === selectedState);
      target = { targetType: TargetType.STATE, stateId: selectedState, locationName: st?.name };
    } else {
      return;
    }

    onAddTarget(target);
    // Reset lower fields only? Or keep for rapid adding? Let's keep state.
    setSelectedWard("");
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
      <h3 className="font-medium text-gray-900 dark:text-gray-100">Select Administrative Area</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* State */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">State</label>
          <select
            className="w-full p-2 rounded border bg-white dark:bg-gray-800"
            value={selectedState}
            onChange={(e) => { setSelectedState(e.target.value); setSelectedLga(""); setSelectedWard(""); }}
          >
            <option value="">Select State...</option>
            {states?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* LGA */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">LGA</label>
          <select
            className="w-full p-2 rounded border bg-white dark:bg-gray-800"
            value={selectedLga}
            onChange={(e) => { setSelectedLga(e.target.value); setSelectedWard(""); }}
            disabled={!selectedState}
          >
            <option value="">{loadingLgas ? "Loading..." : "All LGAs"}</option>
            {lgas?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {/* Ward */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ward</label>
          <select
            className="w-full p-2 rounded border bg-white dark:bg-gray-800"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            disabled={!selectedLga}
          >
            <option value="">{loadingWards ? "Loading..." : "All Wards"}</option>
            {wards?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          disabled={!selectedState}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add Target Area
        </button>
      </div>
    </div>
  );
}