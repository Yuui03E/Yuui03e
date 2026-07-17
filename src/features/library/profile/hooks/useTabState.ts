import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function useTabState() {
  // React Router tabs sync with memory
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab) return queryTab;
    const savedTab = localStorage.getItem("profile_active_tab");
    return savedTab || "overview";
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
    localStorage.setItem("profile_active_tab", tab);
  };

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab && queryTab !== activeTab) {
      setActiveTabState(queryTab);
    }
  }, [searchParams]);

  return { activeTab, setActiveTab };
}
