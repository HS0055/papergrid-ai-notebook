import React from 'react';

interface PianoKeyboardProps {
  selectedPitch: { pitch: string; octave: number } | null;
  onSelectPitch: (pitch: { pitch: string; octave: number } | null) => void;
  selectedDuration: 'whole' | 'half' | 'quarter' | 'eighth';
  onSelectDuration: (duration: 'whole' | 'half' | 'quarter' | 'eighth') => void;
}

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Black key positions relative to each white key (null = no black key after)
const BLACK_KEY_MAP: Record<string, string | null> = {
  C: 'C#', D: 'D#', E: null, F: 'F#', G: 'G#', A: 'A#', B: null,
};

const DURATION_BUTTONS: { value: 'whole' | 'half' | 'quarter' | 'eighth'; symbol: string; label: string }[] = [
  { value: 'whole', symbol: '\u{1D15D}', label: 'Whole' },
  { value: 'half', symbol: '\u{1D15E}', label: 'Half' },
  { value: 'quarter', symbol: '\u{1D15F}', label: 'Quarter' },
  { value: 'eighth', symbol: '\u{1D160}', label: 'Eighth' },
];

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  selectedPitch,
  onSelectPitch,
  selectedDuration,
  onSelectDuration,
}) => {
  const octaves = [3, 4];

  const isSelected = (pitch: string, octave: number) =>
    selectedPitch?.pitch === pitch && selectedPitch?.octave === octave;

  const handleKeyClick = (pitch: string, octave: number) => {
    if (isSelected(pitch, octave)) {
      onSelectPitch(null); // Deselect
    } else {
      onSelectPitch({ pitch, octave });
    }
  };

  return (
    <div className="bg-gradient-to-t from-gray-100 to-white border-t border-gray-200 shrink-0">
      {/* Duration selector */}
      <div className="flex items-center justify-center gap-1 py-1.5 px-3 border-b border-gray-100">
        <span className="text-[10px] text-gray-400 font-sans uppercase tracking-wider mr-2">Duration:</span>
        {DURATION_BUTTONS.map(d => (
          <button
            key={d.value}
            onClick={() => onSelectDuration(d.value)}
            className={`px-2 py-0.5 rounded text-sm transition-all ${
              selectedDuration === d.value
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title={d.label}
          >
            {d.symbol}
          </button>
        ))}
      </div>

      {/* Piano keys */}
      <div className="flex justify-center px-2 py-2 overflow-x-auto">
        <div className="relative flex">
          {octaves.map(octave => (
            <div key={octave} className="relative flex">
              {WHITE_KEYS.map((key, keyIdx) => {
                const selected = isSelected(key, octave);
                return (
                  <button
                    key={`${key}${octave}`}
                    onClick={() => handleKeyClick(key, octave)}
                    className={`relative w-9 h-12 border border-gray-300 rounded-b-md transition-all z-0 ${
                      selected
                        ? 'bg-indigo-200 border-indigo-400 shadow-inner'
                        : 'bg-white hover:bg-gray-50 active:bg-gray-100'
                    } ${keyIdx === 0 && octave === octaves[0] ? 'rounded-bl-lg' : ''} ${
                      keyIdx === WHITE_KEYS.length - 1 && octave === octaves[octaves.length - 1] ? 'rounded-br-lg' : ''
                    }`}
                  >
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-sans ${
                      selected ? 'text-indigo-700 font-bold' : 'text-gray-400'
                    }`}>
                      {key}{octave}
                    </span>
                  </button>
                );
              })}

              {/* Black keys overlay */}
              {WHITE_KEYS.map((key, keyIdx) => {
                const blackKey = BLACK_KEY_MAP[key];
                if (!blackKey) return null;
                // Position black key between white keys
                const leftOffset = (keyIdx + 1) * 36 - 12; // 36px per white key, offset to center
                return (
                  <button
                    key={`${blackKey}${octave}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // For now, black keys select the base pitch (sharps/flats can be extended later)
                      handleKeyClick(key, octave);
                    }}
                    className="absolute top-0 w-6 h-7 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-b-md z-10 border border-gray-900 shadow-md"
                    style={{ left: `${leftOffset}px` }}
                    title={`${blackKey}${octave}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
