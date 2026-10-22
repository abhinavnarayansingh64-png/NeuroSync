import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const buttonSource = readFileSync(new URL('../client/src/components/ui/Button.jsx', import.meta.url), 'utf8');
const fieldSource = readFileSync(new URL('../client/src/components/ui/Field.jsx', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../client/src/components/ui/Card.jsx', import.meta.url), 'utf8');
const receiverSource = readFileSync(new URL('../client/src/pages/ReceiverDashboard.jsx', import.meta.url), 'utf8');
const receiverHardwareSource = readFileSync(new URL('../client/src/pages/ReceiverHardware.jsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../client/src/index.css', import.meta.url), 'utf8');

describe('shared button contrast safeguards', () => {
  it('uses direct dark ink for cream-filled primary controls', () => {
    expect(buttonSource).toContain("const controlStyle = isSolid ? { color: '#151310', ...styleProp } : styleProp");
    expect(buttonSource).toContain('style={controlStyle}');
  });

  it('keeps solid variants explicit so their contrast behavior cannot silently drift', () => {
    expect(buttonSource).toContain("primary: 'ns-solid-button bg-accent");
    expect(buttonSource).toContain("'danger-solid': 'ns-solid-button bg-status-danger-strong");
  });

  it('keeps secondary actions visibly cream on a dark surface', () => {
    expect(buttonSource).toContain("secondary:\n    'bg-[#1b1916] text-[#f7f0e5]");
    expect(buttonSource).toContain('hover:text-[#fffdf7]');
  });

  it('keeps cream outline actions readable for the Premium Start trial control', () => {
    expect(buttonSource).toContain("outline:\n    'bg-accent text-[#151310]");
    expect(buttonSource).toContain("variant === 'outline'");
  });

  it('keeps explicit receiver acceptance and delivery controls readable without restoring a broken mode switch', () => {
    expect(receiverSource).toContain('Accept job & start delivery');
    expect(receiverSource).toContain('Desktop delivery transfers the protected dataset');
    expect(receiverSource).toContain('Completed and running jobs never expose a download action.');
    expect(receiverSource).not.toContain('role="switch"');
  });

  it('keeps browser desktop-download handoff links readable on cream controls', () => {
    for (const source of [receiverSource, receiverHardwareSource]) {
      expect(source).toContain('ns-solid-button');
      expect(source).toContain("style={{ color: '#151310' }}");
      expect(source).toContain('DESKTOP_PORTABLE_DOWNLOAD_URL');
    }
  });

  it('uses dark indicators when shared checked or completed states use the cream accent fill', () => {
    expect(fieldSource).toContain("checked ? 'translate-x-6 bg-[#151310]' : 'translate-x-1 bg-white'");
    expect(fieldSource).toContain('hidden text-[#151310] peer-checked:block');
    expect(cardSource).toContain("complete ? 'border border-[#fffaf0] bg-[#fffaf0] text-[#171512]");
    expect(cardSource).toContain("border-2 border-[#fffaf0]/80 bg-[#282522] text-[#fffaf0]");
  });

  it('keeps a global keyboard-focus signal for raw menu, selector, drawer, and back controls', () => {
    expect(globalStyles).toContain(':focus-visible {');
    expect(globalStyles).toContain("outline: 2px solid theme('colors.accent.DEFAULT')");
    expect(globalStyles).toContain('outline-offset: 2px;');
  });
});
