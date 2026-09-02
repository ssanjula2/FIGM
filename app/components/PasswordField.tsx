'use client';

import React, { useState } from 'react';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: 'new-password' | 'current-password';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Matches the `.input-field` CSS class used by the auth pages by default; pass `false` to fall
   *  back to plain inline styles (matches app/profile/page.tsx's raw-style form fields instead). */
  useInputFieldClass?: boolean;
  inputStyle?: React.CSSProperties;
  /** Suppresses the built-in `<label>` entirely (e.g. a design that only ever used a placeholder,
   *  never a visible label). The `aria-label` on the input itself still carries `label`'s text
   *  either way, so the field stays accessible. Prefer `labelTrailing` over this when the only
   *  reason to hide the label was to make room for something else on the same row. */
  hideLabel?: boolean;
  /** Extra content rendered on the same row as the label, right-aligned (e.g. a "Forgot Password?"
   *  link) -- keeps the real `<label htmlFor>` association intact instead of callers reaching for
   *  `hideLabel` and rolling their own unassociated label text just to fit a link on that row. */
  labelTrailing?: React.ReactNode;
}

const rawInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: '#090d16',
  color: '#f8fafc',
  fontSize: '13px',
  boxSizing: 'border-box',
};

/**
 * Password `<input>` with a Show/Hide toggle that never sends or persists the revealed value
 * anywhere -- it only flips this input's own `type` between `password` and `text` client-side.
 * The value itself is never trimmed/normalized here (or anywhere in the auth flow): whatever the
 * user types is exactly what gets submitted.
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  required = true,
  placeholder = '••••••••',
  hint,
  useInputFieldClass = true,
  inputStyle,
  hideLabel = false,
  labelTrailing,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {!hideLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label
            htmlFor={id}
            style={{ display: 'block', color: '#cbd5e1', fontSize: useInputFieldClass ? '13px' : '12px', fontWeight: 700 }}
          >
            {label}
            {hint ? <span style={{ fontWeight: 500, color: '#7c8ba6' }}> ({hint})</span> : null}
          </label>
          {labelTrailing}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-label={label}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={useInputFieldClass ? 'input-field' : undefined}
          style={{
            ...(useInputFieldClass ? {} : rawInputStyle),
            ...inputStyle,
            width: '100%',
            paddingRight: '44px',
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          tabIndex={0}
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: '#7c8ba6',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '6px 8px',
          }}
        >
          {visible ? '🙈 Hide' : '👁️ Show'}
        </button>
      </div>
    </div>
  );
}
