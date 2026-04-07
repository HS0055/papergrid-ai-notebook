import React, { useRef, useState, useEffect } from 'react';
import type { IsoFlowData, IsoStep, IsoStepType } from '@papergrid/core';

interface IsoPaperCanvasProps {
  data?: IsoFlowData;
  onChange: (data: IsoFlowData) => void;
}

/*
 * IsoPaperCanvas — interactive overlay for isometric paper.
 *
 * Mirrors the 32x55.42 .paper-isometric background grid. Steps snap to grid
 * cells along a process flow. The canvas is transparent — users see the
 * isometric paper pattern beneath.
 */

// Snap grid for iso paper — derived from .paper-isometric tile (32 wide, 55.42 tall).
const GRID_STEP_X = 128; // 4 tiles
const GRID_STEP_Y = 166.26; // 3 tiles
const STEP_WIDTH = 120;
const STEP_HEIGHT = 60;
const ISO_SKEW = 14;

const STEP_THEME: Record<string, { fill: string; side: string; stroke: string; text: string }> = {
  rose: { fill: 'rgba(255,241,242,0.94)', side: 'rgba(254,205,211,0.94)', stroke: '#f43f5e', text: '#9f1239' },
  indigo: { fill: 'rgba(238,242,255,0.94)', side: 'rgba(199,210,254,0.94)', stroke: '#6366f1', text: '#3730a3' },
  emerald: { fill: 'rgba(236,253,245,0.94)', side: 'rgba(167,243,208,0.94)', stroke: '#10b981', text: '#065f46' },
  amber: { fill: 'rgba(255,251,235,0.94)', side: 'rgba(253,230,138,0.94)', stroke: '#f59e0b', text: '#92400e' },
  sky: { fill: 'rgba(240,249,255,0.94)', side: 'rgba(186,230,253,0.94)', stroke: '#0ea5e9', text: '#075985' },
  slate: { fill: 'rgba(248,250,252,0.94)', side: 'rgba(226,232,240,0.94)', stroke: '#64748b', text: '#334155' },
  violet: { fill: 'rgba(245,243,255,0.94)', side: 'rgba(221,214,254,0.94)', stroke: '#8b5cf6', text: '#5b21b6' },
};

const COLOR_CYCLE = Object.keys(STEP_THEME);
const STEP_TYPES: IsoStepType[] = ['start', 'process', 'decision', 'end'];
const EMPTY_DATA: IsoFlowData = { steps: [], connections: [] };

function snapToIsoGrid(px: number, py: number): { gridX: number; gridY: number } {
  return {
    gridX: Math.max(0, Math.round(px / GRID_STEP_X)),
    gridY: Math.max(0, Math.round(py / GRID_STEP_Y)),
  };
}

function gridToPixel(gridX: number, gridY: number, padX = 60, padY = 60): { x: number; y: number } {
  return {
    x: padX + gridX * GRID_STEP_X,
    y: padY + gridY * GRID_STEP_Y,
  };
}

interface GridPos {
  gridX: number;
  gridY: number;
}

/** Compute default grid position for a new step — append to the right of the last step. */
function nextGridPos(existing: Array<IsoStep & Partial<GridPos>>): GridPos {
  if (existing.length === 0) return { gridX: 0, gridY: 0 };
  const last = existing[existing.length - 1];
  return {
    gridX: ((last as GridPos).gridX ?? 0) + 1,
    gridY: (last as GridPos).gridY ?? 0,
  };
}

function renderShape(
  step: IsoStep,
  x: number,
  y: number,
  theme: (typeof STEP_THEME)[string],
  isSelected: boolean,
): React.ReactElement {
  const w = STEP_WIDTH;
  const h = STEP_HEIGHT;
  const r = step.type === 'start' || step.type === 'end' ? h / 2 : 10;
  const sw = isSelected ? 3 : 2;
  const shadow = isSelected ? { filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))' } : undefined;

  if (step.type === 'decision') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const diamond = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;
    const topFace = `${cx + ISO_SKEW},${y - ISO_SKEW} ${x + w + ISO_SKEW},${cy - ISO_SKEW} ${x + w},${cy} ${cx},${y}`;
    return (
      <g style={shadow}>
        <polygon points={topFace} fill={theme.side} stroke={theme.stroke} strokeWidth={sw} strokeLinejoin="round" />
        <polygon points={diamond} fill={theme.fill} stroke={theme.stroke} strokeWidth={sw} strokeLinejoin="round" />
      </g>
    );
  }

  const topFace = `M ${x + ISO_SKEW},${y - ISO_SKEW} L ${x + w + ISO_SKEW},${y - ISO_SKEW} L ${x + w},${y} L ${x},${y} Z`;
  const rightFace = `M ${x + w},${y} L ${x + w + ISO_SKEW},${y - ISO_SKEW} L ${x + w + ISO_SKEW},${y + h - ISO_SKEW} L ${x + w},${y + h} Z`;
  return (
    <g style={shadow}>
      <path d={topFace} fill={theme.side} stroke={theme.stroke} strokeWidth={sw} strokeLinejoin="round" />
      <path d={rightFace} fill={theme.side} stroke={theme.stroke} strokeWidth={sw} strokeLinejoin="round" />
      <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill={theme.fill} stroke={theme.stroke} strokeWidth={sw} />
    </g>
  );
}

// Augment IsoStep with grid positioning (kept alongside the base type so existing
// code without coordinates still renders, auto-laid out left-to-right).
type PositionedStep = IsoStep & GridPos;

function positionSteps(steps: IsoStep[], stored?: Record<string, GridPos>): PositionedStep[] {
  const positioned: PositionedStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const storedPos = stored?.[step.id];
    if (storedPos) {
      positioned.push({ ...step, ...storedPos });
    } else {
      // Auto layout: 4 columns, wrap to next row
      positioned.push({ ...step, gridX: i % 4, gridY: Math.floor(i / 4) });
    }
  }
  return positioned;
}

export const IsoPaperCanvas: React.FC<IsoPaperCanvasProps> = ({ data, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 1000 });
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ id: string; value: string } | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  // Local grid positions keyed by step id (overlays; persisted alongside steps in future)
  const [positions, setPositions] = useState<Record<string, GridPos>>({});

  const flowData = data ?? EMPTY_DATA;
  const steps = positionSteps(flowData.steps, positions);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const parent = svg.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(entry.contentRect.height, 400),
        });
      }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const update = (next: IsoFlowData) => onChange(next);

  const getSvgPoint = (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const handleBackgroundClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName !== 'svg' && target.tagName !== 'rect') return;
    if (connectFromId) {
      setConnectFromId(null);
      return;
    }
    const point = getSvgPoint(e);
    if (!point) return;
    // Offset by padding before snapping
    const { gridX, gridY } = snapToIsoGrid(point.x - 60, point.y - 60);

    const occupied = steps.some((s) => s.gridX === gridX && s.gridY === gridY);
    if (occupied) return;

    const newStep: IsoStep = {
      id: crypto.randomUUID(),
      label: 'Step',
      type: flowData.steps.length === 0 ? 'start' : 'process',
      color: 'indigo',
    };
    setPositions((prev) => ({ ...prev, [newStep.id]: { gridX, gridY } }));
    // Auto-connect from the previous step if any
    const prevStep = flowData.steps[flowData.steps.length - 1];
    const newConnections = prevStep
      ? [{ id: crypto.randomUUID(), from: prevStep.id, to: newStep.id }]
      : [];
    update({
      steps: [...flowData.steps, newStep],
      connections: [...flowData.connections, ...newConnections],
    });
    setSelectedStepId(newStep.id);
    setEditingLabel({ id: newStep.id, value: 'Step' });
    e.stopPropagation();
  };

  const handleStepClick = (e: React.MouseEvent, stepId: string) => {
    e.stopPropagation();
    if (connectFromId) {
      if (connectFromId !== stepId) {
        const exists = flowData.connections.some(
          (c) =>
            (c.from === connectFromId && c.to === stepId) ||
            (c.from === stepId && c.to === connectFromId),
        );
        if (!exists) {
          update({
            ...flowData,
            connections: [
              ...flowData.connections,
              { id: crypto.randomUUID(), from: connectFromId, to: stepId },
            ],
          });
        }
      }
      setConnectFromId(null);
      return;
    }
    if (e.shiftKey) {
      setConnectFromId(stepId);
      setSelectedStepId(null);
      return;
    }
    const step = flowData.steps.find((s) => s.id === stepId);
    if (!step) return;
    setSelectedStepId(stepId);
    setEditingLabel({ id: stepId, value: step.label });
  };

  const handleConnectionClick = (e: React.MouseEvent, connId: string) => {
    e.stopPropagation();
    update({
      ...flowData,
      connections: flowData.connections.filter((c) => c.id !== connId),
    });
  };

  const commitLabel = () => {
    if (!editingLabel) return;
    const nextSteps = flowData.steps.map((s) =>
      s.id === editingLabel.id ? { ...s, label: editingLabel.value.trim() || 'Step' } : s,
    );
    update({ ...flowData, steps: nextSteps });
    setEditingLabel(null);
  };

  const cycleType = (stepId: string) => {
    const step = flowData.steps.find((s) => s.id === stepId);
    if (!step) return;
    const idx = STEP_TYPES.indexOf(step.type);
    const nextType = STEP_TYPES[(idx + 1) % STEP_TYPES.length];
    const nextSteps = flowData.steps.map((s) => (s.id === stepId ? { ...s, type: nextType } : s));
    update({ ...flowData, steps: nextSteps });
  };

  const cycleColor = (stepId: string) => {
    const step = flowData.steps.find((s) => s.id === stepId);
    if (!step) return;
    const idx = COLOR_CYCLE.indexOf(step.color);
    const nextColor = COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length];
    const nextSteps = flowData.steps.map((s) =>
      s.id === stepId ? { ...s, color: nextColor } : s,
    );
    update({ ...flowData, steps: nextSteps });
  };

  const deleteStep = (stepId: string) => {
    const nextSteps = flowData.steps.filter((s) => s.id !== stepId);
    const nextConnections = flowData.connections.filter(
      (c) => c.from !== stepId && c.to !== stepId,
    );
    update({ steps: nextSteps, connections: nextConnections });
    setPositions((prev) => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
    setSelectedStepId(null);
    setEditingLabel(null);
  };

  const startConnect = (stepId: string) => {
    setConnectFromId(stepId);
    setEditingLabel(null);
    setSelectedStepId(null);
  };

  const selectedStep = selectedStepId
    ? steps.find((s) => s.id === selectedStepId)
    : null;

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ pointerEvents: 'auto' }}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMin slice"
        onClick={handleBackgroundClick}
        role="img"
        aria-label="Isometric flow canvas"
      >
        <defs>
          <marker
            id="iso-canvas-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
        />

        {/* Connections */}
        {flowData.connections.map((conn) => {
          const from = steps.find((s) => s.id === conn.from);
          const to = steps.find((s) => s.id === conn.to);
          if (!from || !to) return null;
          const fromPos = gridToPixel(from.gridX, from.gridY);
          const toPos = gridToPixel(to.gridX, to.gridY);
          const fromX = fromPos.x + STEP_WIDTH;
          const fromY = fromPos.y + STEP_HEIGHT / 2;
          const toX = toPos.x;
          const toY = toPos.y + STEP_HEIGHT / 2;
          return (
            <g key={conn.id} className="cursor-pointer" onClick={(e) => handleConnectionClick(e, conn.id)}>
              <line
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke="#475569"
                strokeWidth={2.5}
                strokeLinecap="round"
                markerEnd="url(#iso-canvas-arrow)"
              />
            </g>
          );
        })}

        {/* Steps */}
        {steps.map((step) => {
          const { x, y } = gridToPixel(step.gridX, step.gridY);
          const theme = STEP_THEME[step.color] ?? STEP_THEME.slate;
          const isSelected = selectedStepId === step.id;
          return (
            <g
              key={step.id}
              className="cursor-pointer"
              onClick={(e) => handleStepClick(e, step.id)}
            >
              {renderShape(step, x, y, theme, isSelected)}
              <text
                x={x + STEP_WIDTH / 2}
                y={y + STEP_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill={theme.text}
                style={{ pointerEvents: 'none' }}
              >
                {step.label.length > 14 ? `${step.label.slice(0, 13)}…` : step.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Inline label editor */}
      {editingLabel && selectedStep && (() => {
        const { x, y } = gridToPixel(selectedStep.gridX, selectedStep.gridY);
        return (
          <div
            className="absolute z-20"
            style={{
              left: `${x + STEP_WIDTH / 2}px`,
              top: `${y + STEP_HEIGHT + 16}px`,
              transform: 'translate(-50%, 0)',
            }}
          >
            <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-lg border border-gray-200 p-2 flex items-center gap-1">
              <input
                autoFocus
                value={editingLabel.value}
                onChange={(e) => setEditingLabel({ ...editingLabel, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitLabel();
                  if (e.key === 'Escape') setEditingLabel(null);
                }}
                onBlur={commitLabel}
                maxLength={30}
                className="text-xs font-sans bg-white border border-gray-200 rounded px-2 py-1 w-36 focus:outline-none focus:border-indigo-400"
                placeholder="Step..."
              />
              <button
                onClick={() => cycleType(selectedStep.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-indigo-500 hover:text-indigo-700 px-1.5 py-1 rounded hover:bg-indigo-50"
                title="Cycle type"
              >
                {selectedStep.type}
              </button>
              <button
                onClick={() => startConnect(selectedStep.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100"
                title="Connect to another step"
              >
                Link
              </button>
              <button
                onClick={() => cycleColor(selectedStep.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100"
                title="Cycle color"
              >
                Hue
              </button>
              <button
                onClick={() => deleteStep(selectedStep.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-red-400 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50"
                title="Delete step"
              >
                Del
              </button>
            </div>
          </div>
        );
      })()}

      {connectFromId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-indigo-500/95 text-white text-xs font-sans px-3 py-1.5 rounded-full shadow-lg">
          Tap another step to connect · Esc to cancel
        </div>
      )}
    </>
  );
};
