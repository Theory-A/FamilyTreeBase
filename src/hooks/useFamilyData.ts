"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FamilyNode, FamilyTreeData } from "@/types/family";

interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
}

interface CreateNodeParams {
  node: Omit<FamilyNode, "id">;
  childrenToLink?: string[];
}

type SaveStatus = "idle" | "saving" | "error";

interface PendingSave {
  node: FamilyNode;
  version: number;
  retryCount: number;
}

interface UseFamilyDataReturn {
  nodes: FamilyTreeData;
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  pendingSaveCount: number;
  updateNode: (node: FamilyNode) => Result<FamilyNode>;
  createNode: (params: CreateNodeParams) => Promise<Result<{ id: string; node: FamilyNode }>>;
  deleteNode: (nodeId: string) => Promise<Result>;
  refetch: () => Promise<void>;
  retryFailedSaves: () => void;
}

const MAX_RETRIES = 3;
const BATCH_DELAY_MS = 100; // Short delay to batch rapid updates together

export function useFamilyData(initialNodes: FamilyTreeData): UseFamilyDataReturn {
  // Local state - this is the "optimistic" state shown in UI
  const [nodes, setNodes] = useState<FamilyTreeData>(initialNodes);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [pendingSaveCount, setPendingSaveCount] = useState(0);

  // Version tracking for each node to handle concurrent edits
  const nodeVersions = useRef<Map<string, number>>(new Map());

  // Queue of pending saves - keyed by node ID so rapid edits coalesce
  const pendingSaves = useRef<Map<string, PendingSave>>(new Map());

  // Failed saves that need retry
  const failedSaves = useRef<Map<string, PendingSave>>(new Map());

  // Whether a batch save is in progress
  const isBatchSaving = useRef(false);

  // Batch save timer
  const batchTimer = useRef<NodeJS.Timeout | null>(null);

  // AbortController for in-flight fetch requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Process the save queue in batches
  const processSaveQueue = useCallback(async () => {
    if (isBatchSaving.current || pendingSaves.current.size === 0) {
      return;
    }

    isBatchSaving.current = true;
    setSaveStatus("saving");

    // Take a snapshot of current pending saves and their versions
    const savesToProcess = new Map(pendingSaves.current);
    const savedVersions = new Map<string, number>();
    for (const [nodeId, pending] of savesToProcess) {
      savedVersions.set(nodeId, pending.version);
    }
    pendingSaves.current.clear();
    setPendingSaveCount(0);

    try {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Send a single batch update to the server
      const response = await fetch("/api/family/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: Array.from(savesToProcess.values()).map(p => p.node),
          expectedVersions: Object.fromEntries(
            Array.from(savesToProcess.entries()).map(([id, p]) => [id, p.version])
          )
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        // Move failed saves to retry queue
        for (const [nodeId, pending] of savesToProcess) {
          if (pending.retryCount < MAX_RETRIES) {
            failedSaves.current.set(nodeId, {
              ...pending,
              retryCount: pending.retryCount + 1,
            });
          }
        }
        setError(data.error || "Failed to save changes");
        setSaveStatus("error");
      } else {
        // Success - merge server response with local state
        // IMPORTANT: Preserve local changes that happened during the save
        if (data.nodes) {
          setNodes((currentNodes) => {
            // For each node in the response, only use server version if:
            // 1. It wasn't in our save batch (server-side changes like partner sync)
            // 2. OR there's no newer local version pending
            const serverNodes = data.nodes as FamilyTreeData;
            return serverNodes.map((serverNode: FamilyNode) => {
              // Check if there's a newer local version
              const currentVersion = nodeVersions.current.get(serverNode.id) || 0;
              const savedVersion = savedVersions.get(serverNode.id);

              // If this node has been edited since we sent it, keep local version
              if (savedVersion !== undefined && currentVersion > savedVersion) {
                const localNode = currentNodes.find(n => n.id === serverNode.id);
                return localNode || serverNode;
              }

              // Otherwise use server version (includes partner bidirectionality etc)
              return serverNode;
            });
          });
        }
        setError(null);
        setSaveStatus("idle");
        failedSaves.current.clear();
      }
    } catch (err) {
      // Network error - queue for retry
      for (const [nodeId, pending] of savesToProcess) {
        if (pending.retryCount < MAX_RETRIES) {
          failedSaves.current.set(nodeId, {
            ...pending,
            retryCount: pending.retryCount + 1,
          });
        }
      }
      const errorMessage = err instanceof Error ? err.message : "Network error";
      setError(errorMessage);
      setSaveStatus("error");
    } finally {
      isBatchSaving.current = false;

      // If more saves queued while we were processing, schedule another batch
      if (pendingSaves.current.size > 0) {
        scheduleBatchSave();
      }
    }
  }, []);

  // Schedule a batch save after a short delay to allow coalescing
  const scheduleBatchSave = useCallback(() => {
    if (batchTimer.current) {
      clearTimeout(batchTimer.current);
    }
    batchTimer.current = setTimeout(() => {
      processSaveQueue();
    }, BATCH_DELAY_MS);
  }, [processSaveQueue]);

  // Retry failed saves
  const retryFailedSaves = useCallback(() => {
    if (failedSaves.current.size === 0) return;

    // Move failed saves back to pending queue
    for (const [nodeId, pending] of failedSaves.current) {
      pendingSaves.current.set(nodeId, pending);
    }
    failedSaves.current.clear();
    setPendingSaveCount(pendingSaves.current.size);
    setError(null);
    scheduleBatchSave();
  }, [scheduleBatchSave]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/family", {
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to fetch family data");
      }
      const data = await response.json();
      setNodes(data.nodes);
      // Clear any pending saves since we just got fresh data
      pendingSaves.current.clear();
      failedSaves.current.clear();
      setPendingSaveCount(0);
      setSaveStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateNode = useCallback(
    (node: FamilyNode): Result<FamilyNode> => {
      // Increment version for this node
      const currentVersion = nodeVersions.current.get(node.id) || 0;
      const newVersion = currentVersion + 1;
      nodeVersions.current.set(node.id, newVersion);

      // Optimistic update - immediately update local state
      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? node : n))
      );

      // Queue the save - later updates to same node will overwrite this
      pendingSaves.current.set(node.id, {
        node,
        version: newVersion,
        retryCount: 0,
      });
      setPendingSaveCount(pendingSaves.current.size);

      // Schedule batch save (will coalesce with other rapid updates)
      scheduleBatchSave();

      // Return immediately - save happens in background
      return { success: true, data: node };
    },
    [scheduleBatchSave]
  );

  const createNode = useCallback(
    async (params: CreateNodeParams): Promise<Result<{ id: string; node: FamilyNode }>> => {
      // Don't set isLoading - the modal has its own spinner
      setError(null);

      try {
        // Create a new AbortController for this request
        const controller = new AbortController();

        const response = await fetch("/api/family", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to create");
          return {
            success: false,
            error: data.error,
            details: data.details,
          };
        }

        // Update state with the response data (includes new node and any server-side updates)
        if (data.nodes) {
          setNodes(data.nodes);
        } else if (data.node) {
          // Fallback: add the new node to the existing list
          setNodes((prev) => [...prev, data.node]);
        }

        return { success: true, data: { id: data.id, node: data.node } };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const deleteNode = useCallback(
    async (nodeId: string): Promise<Result> => {
      // Store original for potential display (but we won't auto-rollback)
      const originalNodes = [...nodes];

      // Optimistic update - remove the node immediately
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));

      // Clear any pending saves for this node
      pendingSaves.current.delete(nodeId);
      failedSaves.current.delete(nodeId);

      try {
        // Create a new AbortController for this request
        const controller = new AbortController();

        const response = await fetch(`/api/family/${nodeId}`, {
          method: "DELETE",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          // Rollback on error - deletion is harder to recover from
          setNodes(originalNodes);
          setError(data.error || "Failed to delete");
          return {
            success: false,
            error: data.error,
            details: data.details,
          };
        }

        // Update state with the response data (includes cleanup of parent/partner refs)
        if (data.nodes) {
          setNodes(data.nodes);
        }
        // If no nodes in response, keep the optimistic update (node already removed)

        return { success: true };
      } catch (err) {
        // Rollback on error
        setNodes(originalNodes);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [nodes]
  );

  // Cleanup batch timer and abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (batchTimer.current) {
        clearTimeout(batchTimer.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    nodes,
    isLoading,
    error,
    saveStatus,
    pendingSaveCount,
    updateNode,
    createNode,
    deleteNode,
    refetch,
    retryFailedSaves,
  };
}
