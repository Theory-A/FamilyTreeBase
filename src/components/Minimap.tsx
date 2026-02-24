"use client";

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";

interface MinimapRow {
  id: string;
  depth: number;
  isMale: boolean;
  isFemale: boolean;
  isSpouse: boolean;
  isPlaceholder: boolean;
  treeIndex?: number;
}

interface MinimapProps {
  rows: MinimapRow[];
  maxDepth: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  colWidth: number;
  onNavigate?: (scrollTop: number, scrollLeft: number) => void;
}

export default function Minimap({
  rows,
  maxDepth,
  containerRef,
  colWidth,
  onNavigate,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({
    scrollTop: 0,
    scrollLeft: 0,
    clientWidth: 0,
    clientHeight: 0,
    scrollWidth: 0,
    scrollHeight: 0,
  });

  // Minimap dimensions
  const MINIMAP_MAX_WIDTH = 250;
  const MINIMAP_MAX_HEIGHT = 400;
  const ROW_HEIGHT = 4;
  const ROW_GAP = 2;
  const PADDING_X = 0;
  const PADDING_Y = 0;
  const DEPTH_STEP = 18;
  const NODE_WIDTH = 16;

  // Calculate minimap content dimensions based on tree structure
  const minimapContentWidth = (maxDepth + 1) * DEPTH_STEP + NODE_WIDTH;
  const minimapContentHeight = rows.length * (ROW_HEIGHT + ROW_GAP);

  // Scale to fit within bounds
  const scaleToFitHeight = (MINIMAP_MAX_HEIGHT - PADDING_Y * 2) / Math.max(minimapContentHeight, 1);
  const scale = Math.min(scaleToFitHeight, 1);

  // Dynamic width based on content, with padding
  const scaledWidth = Math.min(MINIMAP_MAX_WIDTH, minimapContentWidth * scale + PADDING_X * 2);
  const scaledHeight = Math.min(MINIMAP_MAX_HEIGHT, minimapContentHeight * scale + PADDING_Y * 2);

  // Update viewport state on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateViewport = () => {
      setViewport({
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
      });
    };

    updateViewport();
    container.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      resizeObserver.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef is a stable ref object
  }, []);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = scaledWidth * dpr;
    canvas.height = scaledHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas with background
    ctx.fillStyle = "rgba(255, 251, 235, 0.98)";
    ctx.fillRect(0, 0, scaledWidth, scaledHeight);

    // Draw content area background
    const contentAreaX = PADDING_X;
    const contentAreaY = PADDING_Y;
    const contentAreaW = scaledWidth - PADDING_X * 2;
    const contentAreaH = scaledHeight - PADDING_Y * 2;

    ctx.fillStyle = "rgba(254, 243, 199, 0.3)";
    ctx.fillRect(contentAreaX, contentAreaY, contentAreaW, contentAreaH);

    // Draw rows (nodes in the minimap) with tree separators
    let lastTreeIndex: number | undefined = undefined;
    rows.forEach((row, index) => {
      const y = PADDING_Y + index * (ROW_HEIGHT + ROW_GAP) * scale;

      // Draw tree separator if this is a new tree
      if (row.treeIndex !== undefined && lastTreeIndex !== undefined && row.treeIndex !== lastTreeIndex) {
        const separatorY = y - (ROW_GAP * scale) / 2;
        ctx.strokeStyle = "rgba(217, 119, 6, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(PADDING_X, separatorY);
        ctx.lineTo(scaledWidth - PADDING_X, separatorY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      lastTreeIndex = row.treeIndex;

      const x = PADDING_X + row.depth * DEPTH_STEP * scale;
      const width = NODE_WIDTH * scale;
      const height = ROW_HEIGHT * scale;

      if (row.isPlaceholder) {
        ctx.fillStyle = "rgba(251, 207, 232, 0.4)";
        ctx.strokeStyle = "rgba(236, 72, 153, 0.3)";
        ctx.setLineDash([1, 1]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
      } else if (row.isMale) {
        ctx.fillStyle = "rgba(96, 165, 250, 0.85)";
        ctx.fillRect(x, y, width, height);
      } else if (row.isFemale) {
        ctx.fillStyle = "rgba(244, 114, 182, 0.85)";
        ctx.fillRect(x, y, width, height);
      } else {
        ctx.fillStyle = "rgba(156, 163, 175, 0.7)";
        ctx.fillRect(x, y, width, height);
      }
    });

    // Draw viewport rectangle using actual scroll dimensions
    if (viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight) {
      const scrollableWidth = Math.max(viewport.scrollWidth, viewport.clientWidth);
      const scrollableHeight = Math.max(viewport.scrollHeight, viewport.clientHeight);

      // Map scroll position to minimap coordinates
      const viewportXRatio = viewport.scrollLeft / scrollableWidth;
      const viewportYRatio = viewport.scrollTop / scrollableHeight;
      const viewportWRatio = viewport.clientWidth / scrollableWidth;
      const viewportHRatio = viewport.clientHeight / scrollableHeight;

      const vpX = PADDING_X + viewportXRatio * contentAreaW;
      const vpY = PADDING_Y + viewportYRatio * contentAreaH;
      const vpW = Math.max(10, viewportWRatio * contentAreaW);
      const vpH = Math.max(10, viewportHRatio * contentAreaH);

      // Semi-transparent fill for viewport
      ctx.fillStyle = "rgba(251, 146, 60, 0.15)";
      ctx.beginPath();
      ctx.roundRect(vpX, vpY, vpW, vpH, 2);
      ctx.fill();

      // Viewport border
      ctx.strokeStyle = "rgba(234, 88, 12, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(vpX, vpY, vpW, vpH, 2);
      ctx.stroke();
    }

  }, [rows, maxDepth, viewport, scale, scaledWidth, scaledHeight]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, scrollLeft: 0, scrollTop: 0 });

  // Content area dimensions (used for mapping)
  const contentAreaW = scaledWidth - PADDING_X * 2;
  const contentAreaH = scaledHeight - PADDING_Y * 2;

  // Get current viewport rect in minimap coordinates (using state, not live container)
  const getViewportRect = useCallback(() => {
    const scrollableWidth = Math.max(viewport.scrollWidth, viewport.clientWidth);
    const scrollableHeight = Math.max(viewport.scrollHeight, viewport.clientHeight);

    if (scrollableWidth === 0 || scrollableHeight === 0) return null;

    const viewportXRatio = viewport.scrollLeft / scrollableWidth;
    const viewportYRatio = viewport.scrollTop / scrollableHeight;
    const viewportWRatio = viewport.clientWidth / scrollableWidth;
    const viewportHRatio = viewport.clientHeight / scrollableHeight;

    return {
      x: PADDING_X + viewportXRatio * contentAreaW,
      y: PADDING_Y + viewportYRatio * contentAreaH,
      w: Math.max(10, viewportWRatio * contentAreaW),
      h: Math.max(10, viewportHRatio * contentAreaH),
    };
  }, [viewport, contentAreaW, contentAreaH]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const vpRect = getViewportRect();
      if (!vpRect) return;

      // Check if click is inside the viewport rectangle
      const isInsideViewport =
        mouseX >= vpRect.x &&
        mouseX <= vpRect.x + vpRect.w &&
        mouseY >= vpRect.y &&
        mouseY <= vpRect.y + vpRect.h;

      if (isInsideViewport) {
        // Store starting positions for delta-based dragging
        dragStartRef.current = {
          mouseX,
          mouseY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
      } else {
        // Click outside viewport - jump to center viewport on click location
        const clickRatioX = (mouseX - PADDING_X) / contentAreaW;
        const clickRatioY = (mouseY - PADDING_Y) / contentAreaH;

        // Center the viewport on the click point
        const newScrollLeft = clickRatioX * container.scrollWidth - container.clientWidth / 2;
        const newScrollTop = clickRatioY * container.scrollHeight - container.clientHeight / 2;

        const scrollRangeX = container.scrollWidth - container.clientWidth;
        const scrollRangeY = container.scrollHeight - container.clientHeight;

        container.scrollLeft = Math.max(0, Math.min(scrollRangeX, newScrollLeft));
        container.scrollTop = Math.max(0, Math.min(scrollRangeY, newScrollTop));

        // Set up drag from the center of the viewport at its new position
        dragStartRef.current = {
          mouseX,
          mouseY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
      }

      setIsDragging(true);
    },
    [getViewportRect, containerRef, contentAreaW, contentAreaH]
  );

  // Global mouse move/up handlers for drag
  useLayoutEffect(() => {
    if (!isDragging) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate mouse delta in minimap coordinates
      const deltaX = mouseX - dragStartRef.current.mouseX;
      const deltaY = mouseY - dragStartRef.current.mouseY;

      // Convert minimap delta to scroll delta
      // minimap contentArea maps to scroll range (scrollWidth - clientWidth)
      const scrollRangeX = container.scrollWidth - container.clientWidth;
      const scrollRangeY = container.scrollHeight - container.clientHeight;

      const scrollDeltaX = (deltaX / contentAreaW) * container.scrollWidth;
      const scrollDeltaY = (deltaY / contentAreaH) * container.scrollHeight;

      // Apply new scroll position directly (instant, no smooth)
      const newScrollLeft = Math.max(0, Math.min(scrollRangeX, dragStartRef.current.scrollLeft + scrollDeltaX));
      const newScrollTop = Math.max(0, Math.min(scrollRangeY, dragStartRef.current.scrollTop + scrollDeltaY));

      container.scrollLeft = newScrollLeft;
      container.scrollTop = newScrollTop;
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, containerRef, contentAreaW, contentAreaH]);

  // Track if mouse is over the viewport for cursor changes
  const [isOverViewport, setIsOverViewport] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const vpRect = getViewportRect();
      if (!vpRect) {
        setIsOverViewport(false);
        return;
      }

      const isInside =
        mouseX >= vpRect.x &&
        mouseX <= vpRect.x + vpRect.w &&
        mouseY >= vpRect.y &&
        mouseY <= vpRect.y + vpRect.h;

      setIsOverViewport(isInside);
    },
    [isDragging, getViewportRect]
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setIsOverViewport(false);
    }
  }, [isDragging]);

  if (rows.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-4 z-50 rounded-lg shadow-lg overflow-hidden bg-amber-50/95 backdrop-blur-sm border border-amber-200/50"
      style={{ width: scaledWidth }}
    >
      <canvas
        ref={canvasRef}
        className={`block ${isDragging ? "cursor-grabbing" : isOverViewport ? "cursor-grab" : "cursor-pointer"}`}
        style={{ width: scaledWidth, height: scaledHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
