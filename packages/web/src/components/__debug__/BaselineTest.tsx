import React from 'react';

/**
 * Visual baseline alignment test for Lined paper.
 * Mount via ?baselinetest query string to verify Patrick Hand sits on printed lines.
 * REMOVE BEFORE PRODUCTION SHIP.
 */
export const BaselineTest: React.FC = () => (
  <div style={{ padding: 32, background: '#f8f8f6', minHeight: '100vh' }}>
    <h1 style={{ fontFamily: 'sans-serif', marginBottom: 16 }}>
      Baseline Test — Patrick Hand on .paper-lines
    </h1>
    <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#666', marginBottom: 16 }}>
      Every text baseline below MUST sit exactly on a printed horizontal line.
      Try browser zoom 100% / 125% / 150%. If text drifts, adjust <code>ascent-override</code>.
    </p>
    <div
      className="paper-lines"
      style={{
        padding: '8px 60px',
        width: 600,
        minHeight: 800,
        border: '1px solid #ccc',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-hand-baseline)',
          fontSize: '21px',
          lineHeight: '32px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {Array.from({ length: 20 })
          .map((_, i) => `Line ${i + 1}: The quick brown fox jumps over the lazy dog ${i + 1}.`)
          .join('\n')}
      </div>
    </div>
  </div>
);
