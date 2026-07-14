import { useState } from "react";

export function useFilterState() {
  // Dynamic filter states with memory
  const [listFilter, setListFilterState] = useState(() => {
    return localStorage.getItem("profile_list_filter") || "All";
  });
  const setListFilter = (filter: string) => {
    setListFilterState(filter);
    localStorage.setItem("profile_list_filter", filter);
  };

  return { listFilter, setListFilter };
}
