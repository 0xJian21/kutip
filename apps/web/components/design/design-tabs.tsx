"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";

/** Interactive tab samples for the /design tile. */
export function DesignTabs() {
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("month");
  return (
    <div className="grid gap-5">
      <Tabs
        label="Status filter"
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: "All", count: 24 },
          { value: "attention", label: "Needs attention", count: 6 },
          { value: "overdue", label: "Overdue", count: 3, countTone: "warn" },
          { value: "open", label: "Open", count: 11 },
          { value: "settled", label: "Settled", count: 10 },
        ]}
      />
      <Tabs
        label="Period"
        variant="segmented"
        size="sm"
        value={view}
        onChange={setView}
        items={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
          { value: "quarter", label: "Quarter" },
        ]}
      />
    </div>
  );
}
