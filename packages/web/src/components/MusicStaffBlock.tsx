import React from 'react';
import { Block, MusicNote } from '@papergrid/core';

interface MusicStaffBlockProps {
  block: Block;
  onChange: (id: string, updatedBlock: Partial<Block>) => void;
  selectedPitch?: { pitch: string; octave: number } | null;
  selectedDuration?: 'whole' | 'half' | 'quarter' | 'eighth';
}

// Maps pitch+octave to Y coordinate on the SVG staff
// Treble clef: E4 = bottom line (Y:44), each diatonic step = 4.5px up
const PITCH_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const noteToY = (pitch: string, octave: number, clef: 'treble' | 'bass'): number => {
  const pitchIndex = PITCH_ORDER.indexOf(pitch);
  if (pitchIndex === -1) return 44;

  if (clef === 'treble') {
    // E4 = bottom staff line = Y:44
    // Each step up = -4.5px (going up visually)
    const e4Steps = (octave - 4) * 7 + pitchIndex - 2; // E=2 in PITCH_ORDER
    return 44 - e4Steps * 4.5;
  }
  // Bass clef: G2 = bottom line
  const g2Steps = (octave - 2) * 7 + pitchIndex - 4; // G=4 in PITCH_ORDER
  return 44 - g2Steps * 4.5;
};

// Check if note needs ledger lines
const getLedgerLines = (y: number): number[] => {
  const lines: number[] = [];
  // Staff lines are at Y: 8, 17, 26, 35, 44 (matching CSS 128px pattern)
  const staffTop = 8;
  const staffBottom = 44;

  if (y < staffTop) {
    // Above staff — ledger lines at 8-9=~-1, -10, etc.
    for (let ly = staffTop - 9; ly >= y - 2; ly -= 9) {
      lines.push(ly);
    }
  }
  if (y > staffBottom) {
    // Below staff
    for (let ly = staffBottom + 9; ly <= y + 2; ly += 9) {
      lines.push(ly);
    }
  }
  return lines;
};

const DURATION_RX: Record<string, number> = {
  whole: 5,
  half: 4,
  quarter: 3.5,
  eighth: 3.5,
};

export const MusicStaffBlock: React.FC<MusicStaffBlockProps> = ({
  block,
  onChange,
  selectedPitch,
  selectedDuration = 'quarter',
}) => {
  const musicData = block.musicData || { clef: 'treble' as const, timeSignature: '4/4', notes: [] };

  const handleStaffClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!selectedPitch) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;

    // Check if clicking near an existing note (to delete it)
    const clickY = noteToY(selectedPitch.pitch, selectedPitch.octave, musicData.clef);
    const existingNote = musicData.notes.find(
      n => Math.abs(n.position - x) < 3 && Math.abs(noteToY(n.pitch, n.octave, musicData.clef) - clickY) < 5
    );

    if (existingNote) {
      // Delete existing note
      const newNotes = musicData.notes.filter(n => n.id !== existingNote.id);
      onChange(block.id, { musicData: { ...musicData, notes: newNotes } });
    } else {
      // Add new note
      const newNote: MusicNote = {
        id: crypto.randomUUID(),
        pitch: selectedPitch.pitch,
        octave: selectedPitch.octave,
        duration: selectedDuration,
        position: Math.max(5, Math.min(95, x)),
      };
      onChange(block.id, { musicData: { ...musicData, notes: [...musicData.notes, newNote] } });
    }
  };

  const handleNoteClick = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    const newNotes = musicData.notes.filter(n => n.id !== noteId);
    onChange(block.id, { musicData: { ...musicData, notes: newNotes } });
  };

  return (
    <div style={{ marginBottom: '0px', position: 'relative' }}>
      <svg
        viewBox="0 0 100 56"
        className="w-full cursor-crosshair"
        style={{ height: '128px' }}
        onClick={handleStaffClick}
        preserveAspectRatio="none"
      >
        {/* Staff lines */}
        {[8, 17, 26, 35, 44].map(y => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#cbd5e1" strokeWidth="0.3" />
        ))}

        {/* Clef indicator */}
        <text x="1" y="30" fontSize="8" fill="#94a3b8" fontFamily="serif">
          {musicData.clef === 'treble' ? '\u{1D11E}' : '\u{1D122}'}
        </text>

        {/* Notes */}
        {musicData.notes.map(note => {
          const y = noteToY(note.pitch, note.octave, musicData.clef);
          const rx = DURATION_RX[note.duration] || 3.5;
          const isFilled = note.duration === 'quarter' || note.duration === 'eighth';
          const hasStem = note.duration !== 'whole';
          const ledgerLines = getLedgerLines(y);
          const stemUp = y >= 26; // stem goes up if note is below middle of staff

          return (
            <g key={note.id} onClick={(e) => handleNoteClick(e, note.id)} className="cursor-pointer">
              {/* Ledger lines */}
              {ledgerLines.map((ly, i) => (
                <line
                  key={i}
                  x1={note.position - rx - 1}
                  y1={ly}
                  x2={note.position + rx + 1}
                  y2={ly}
                  stroke="#94a3b8"
                  strokeWidth="0.3"
                />
              ))}

              {/* Note head */}
              <ellipse
                cx={note.position}
                cy={y}
                rx={rx}
                ry={2.5}
                fill={isFilled ? '#1e293b' : 'none'}
                stroke="#1e293b"
                strokeWidth="0.4"
                transform={`rotate(-10 ${note.position} ${y})`}
              />

              {/* Stem */}
              {hasStem && (
                <line
                  x1={stemUp ? note.position + rx - 0.5 : note.position - rx + 0.5}
                  y1={y}
                  x2={stemUp ? note.position + rx - 0.5 : note.position - rx + 0.5}
                  y2={stemUp ? y - 18 : y + 18}
                  stroke="#1e293b"
                  strokeWidth="0.4"
                />
              )}

              {/* Flag for eighth notes */}
              {note.duration === 'eighth' && (
                <path
                  d={
                    stemUp
                      ? `M ${note.position + rx - 0.5} ${y - 18} q 3 5 0 10`
                      : `M ${note.position - rx + 0.5} ${y + 18} q -3 -5 0 -10`
                  }
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="0.4"
                />
              )}

              {/* Hover highlight */}
              <ellipse
                cx={note.position}
                cy={y}
                rx={rx + 1.5}
                ry={4}
                fill="transparent"
                className="hover:fill-red-200/40"
              />
            </g>
          );
        })}

        {/* Pitch guide when hovering (if pitch selected) */}
        {selectedPitch && (
          <line
            x1="5"
            y1={noteToY(selectedPitch.pitch, selectedPitch.octave, musicData.clef)}
            x2="95"
            y2={noteToY(selectedPitch.pitch, selectedPitch.octave, musicData.clef)}
            stroke="#6366f1"
            strokeWidth="0.2"
            strokeDasharray="1 1"
            opacity="0.5"
            pointerEvents="none"
          />
        )}
      </svg>

      {musicData.notes.length === 0 && !selectedPitch && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-gray-400 text-sm font-sans opacity-60">Select a key on the piano, then click here</span>
        </div>
      )}
    </div>
  );
};
