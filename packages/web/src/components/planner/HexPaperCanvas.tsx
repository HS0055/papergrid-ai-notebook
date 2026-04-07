import React, { useRef, useState, useEffect } from 'react';
import type { HexMapData, HexNode, HexEdge } from '@papergrid/core';

interface HexPaperCanvasProps {
  data?: HexMapData;
  onChange: (data: HexMapData) => void;
}

/*
 * HexPaperCanvas — interactive overlay for hex paper type.
 *
 * Matches the .paper-hex CSS background grid (56x98 tile).
 * Nodes snap to grid positions. Tap empty cell to place, tap node to edit,
 * drag (shift-click) between nodes to connect.
 *
 * The canvas is fully transparent — users see the hex paper beneath.
 */

// Must match .paper-hex background-size in globals.css
const HEX_TILE_WIDTH = 56;
const HEX_TILE_HEIGHT = 98;
const HEX_RADIUS = 28;

const NODE_THEME: Record<string, { fill: string; stroke: string; text: string }> = {
  rose: { fill: 'rgba(255,241,242,0.92)', stroke: '#f43f5e', text: '#9f1239' },
  indigo: { fill: 'rgba(238,242,255,0.92)', stroke: '#6366f1', text: '#3730a3' },
  emerald: { fill: 'rgba(236,253,245,0.92)', stroke: '#10b981', text: '#065f46' },
  amber: { fill: 'rgba(255,251,235,0.92)', stroke: '#f59e0b', text: '#92400e' },
  sky: { fill: 'rgba(240,249,255,0.92)', stroke: '#0ea5e9', text: '#075985' },
  slate: { fill: 'rgba(248,250,252,0.92)', stroke: '#64748b', text: '#334155' },
  violet: { fill: 'rgba(245,243,255,0.92)', stroke: '#8b5cf6', text: '#5b21b6' },
};

const COLOR_CYCLE = Object.keys(NODE_THEME);

/** Snap a raw pixel position to the nearest hex grid cell and return that cell's centre. */
function snapToHexGrid(px: number, py: number): { gridX: number; gridY: number } {
  // Rough approximation — round to the nearest tile, then compute cell centre.
  const col = Math.round(px / HEX_TILE_WIDTH);
  const row = Math.round(py / HEX_TILE_HEIGHT);
  return { gridX: col, gridY: row };
}

function gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
  // Hex tile centre within the 56x98 tile — vary Y by column parity for honeycomb offset.
  const x = gridX * HEX_TILE_WIDTH + HEX_TILE_WIDTH / 2;
  const y = gridY * HEX_TILE_HEIGHT + HEX_TILE_HEIGHT / 2 + (gridX % 2 !== 0 ? HEX_TILE_HEIGHT / 2 : 0);
  return { x, y };
}

function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6; // point-up hexagon
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  return points.join(' ');
}

const EMPTY_DATA: HexMapData = { nodes: [], edges: [] };

export const HexPaperCanvas: React.FC<HexPaperCanvasProps> = ({ data, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 1000 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ id: string; value: string } | null>(null);

  const mapData = data ?? EMPTY_DATA;

  // Measure the parent container once mounted and on resize
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

  const update = (next: HexMapData) => onChange(next);

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
    // Ignore if click originated from a node or edge marker
    const target = e.target as SVGElement;
    if (target.tagName !== 'svg' && target.tagName !== 'rect') return;
    if (connectFromId) {
      setConnectFromId(null);
      return;
    }
    const point = getSvgPoint(e);
    if (!point) return;
    const { gridX, gridY } = snapToHexGrid(point.x, point.y);

    // Prevent placing on an occupied cell
    const occupied = mapData.nodes.some((n) => n.gridX === gridX && n.gridY === gridY);
    if (occupied) return;

    const newNode: HexNode = {
      id: crypto.randomUUID(),
      label: 'Node',
      color: 'indigo',
      gridX,
      gridY,
    };
    update({ ...mapData, nodes: [...mapData.nodes, newNode] });
    setSelectedNodeId(newNode.id);
    setEditingLabel({ id: newNode.id, value: 'Node' });
    e.stopPropagation();
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectFromId) {
      if (connectFromId !== nodeId) {
        const exists = mapData.edges.some(
          (edge) =>
            (edge.from === connectFromId && edge.to === nodeId) ||
            (edge.from === nodeId && edge.to === connectFromId),
        );
        if (!exists) {
          const newEdge: HexEdge = {
            id: crypto.randomUUID(),
            from: connectFromId,
            to: nodeId,
          };
          update({ ...mapData, edges: [...mapData.edges, newEdge] });
        }
      }
      setConnectFromId(null);
      return;
    }
    if (e.shiftKey) {
      setConnectFromId(nodeId);
      setSelectedNodeId(null);
      return;
    }
    const node = mapData.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setEditingLabel({ id: nodeId, value: node.label });
  };

  const handleEdgeClick = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    update({ ...mapData, edges: mapData.edges.filter((edge) => edge.id !== edgeId) });
  };

  const commitLabel = () => {
    if (!editingLabel) return;
    const nodes = mapData.nodes.map((n) =>
      n.id === editingLabel.id ? { ...n, label: editingLabel.value.trim() || 'Node' } : n,
    );
    update({ ...mapData, nodes });
    setEditingLabel(null);
  };

  const cycleColor = (nodeId: string) => {
    const node = mapData.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const idx = COLOR_CYCLE.indexOf(node.color);
    const nextColor = COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length];
    const nodes = mapData.nodes.map((n) => (n.id === nodeId ? { ...n, color: nextColor } : n));
    update({ ...mapData, nodes });
  };

  const deleteNode = (nodeId: string) => {
    const nodes = mapData.nodes.filter((n) => n.id !== nodeId);
    const edges = mapData.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    update({ nodes, edges });
    setSelectedNodeId(null);
    setEditingLabel(null);
  };

  const startConnect = (nodeId: string) => {
    setConnectFromId(nodeId);
    setEditingLabel(null);
    setSelectedNodeId(null);
  };

  const selectedNode = selectedNodeId
    ? mapData.nodes.find((n) => n.id === selectedNodeId)
    : null;

  return (
    <>
      {/* Full-bleed SVG overlay. pointer-events enabled on the SVG; transparent elsewhere. */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ pointerEvents: 'auto' }}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMin slice"
        onClick={handleBackgroundClick}
        role="img"
        aria-label="Hex map canvas"
      >
        {/* Transparent capture rect so empty-space clicks register */}
        <rect
          x={0}
          y={0}
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
        />

        {/* Edges */}
        {mapData.edges.map((edge) => {
          const fromNode = mapData.nodes.find((n) => n.id === edge.from);
          const toNode = mapData.nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          const from = gridToPixel(fromNode.gridX, fromNode.gridY);
          const to = gridToPixel(toNode.gridX, toNode.gridY);
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={edge.id} onClick={(e) => handleEdgeClick(e, edge.id)} className="cursor-pointer">
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#475569"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={midX} cy={midY} r={6} fill="#fff" stroke="#94a3b8" strokeWidth={1.5} />
              <text
                x={midX}
                y={midY + 2}
                textAnchor="middle"
                fontSize={9}
                fill="#64748b"
                style={{ pointerEvents: 'none' }}
              >
                ×
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {mapData.nodes.map((node) => {
          const { x, y } = gridToPixel(node.gridX, node.gridY);
          const theme = NODE_THEME[node.color] ?? NODE_THEME.slate;
          const isSelected = selectedNodeId === node.id;
          const isConnectSource = connectFromId === node.id;
          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={(e) => handleNodeClick(e, node.id)}
            >
              <polygon
                points={hexPoints(x, y, HEX_RADIUS)}
                fill={theme.fill}
                stroke={theme.stroke}
                strokeWidth={isSelected || isConnectSource ? 3 : 2}
                style={{
                  filter: isSelected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))' : 'none',
                }}
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={theme.text}
                style={{ pointerEvents: 'none' }}
              >
                {node.label.length > 10 ? `${node.label.slice(0, 9)}…` : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating inline label editor for the selected node */}
      {editingLabel && selectedNode && (() => {
        const { x, y } = gridToPixel(selectedNode.gridX, selectedNode.gridY);
        return (
          <div
            className="absolute z-20"
            style={{
              left: `${x}px`,
              top: `${y + HEX_RADIUS + 8}px`,
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
                className="text-xs font-sans bg-white border border-gray-200 rounded px-2 py-1 w-32 focus:outline-none focus:border-indigo-400"
                placeholder="Label..."
              />
              <button
                onClick={() => startConnect(selectedNode.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-indigo-500 hover:text-indigo-700 px-1.5 py-1 rounded hover:bg-indigo-50"
                title="Connect to another hex"
              >
                Link
              </button>
              <button
                onClick={() => cycleColor(selectedNode.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100"
                title="Cycle color"
              >
                Hue
              </button>
              <button
                onClick={() => deleteNode(selectedNode.id)}
                className="text-[10px] font-sans uppercase tracking-wider text-red-400 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50"
                title="Delete hex"
              >
                Del
              </button>
            </div>
          </div>
        );
      })()}

      {/* Connect-mode hint banner */}
      {connectFromId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-indigo-500/95 text-white text-xs font-sans px-3 py-1.5 rounded-full shadow-lg">
          Tap another hex to connect · Esc to cancel
        </div>
      )}
    </>
  );
};
