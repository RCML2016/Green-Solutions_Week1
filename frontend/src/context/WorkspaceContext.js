import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    if (!user) { setWorkspace(null); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/workspace");
      setWorkspace(data);
    } catch (error) {
      console.warn("Workspace config unavailable:", formatApiError(error));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshWorkspace(); }, [refreshWorkspace]);

  const featureEnabled = useCallback(
    (name) => workspace?.features?.[name] !== false,
    [workspace]
  );

  const value = useMemo(() => ({ workspace, loading, featureEnabled, refreshWorkspace }), [workspace, loading, featureEnabled, refreshWorkspace]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);
