import React from 'react';
import type { SignInEntry } from '../lib/form';

export interface SignInRowProps {
  value: SignInEntry;
  onChange: (patch: Partial<SignInEntry>) => void;
  onRemove?: () => void;
  rolePlaceholder?: string;
  showRole?: boolean;
  roleLabel?: string;
  legend?: string;
}

export function SignInRow({
  value,
  onChange,
  onRemove,
  rolePlaceholder = 'member',
  showRole = true,
  roleLabel = 'Role name',
  legend,
}: SignInRowProps) {
  return (
    <fieldset className="grid gap-3 rounded-md border border-rule p-3 sm:grid-cols-2">
      {legend && <legend className="px-1 text-sm font-bold">{legend}</legend>}
      {showRole && (
        <label className="text-sm">
          <span className="mb-1 block font-bold">{roleLabel}</span>
          <input
            className="field py-2 text-sm"
            value={value.role}
            placeholder={rolePlaceholder}
            onChange={(e) => onChange({ role: e.target.value })}
          />
        </label>
      )}
      <label className="text-sm">
        <span className="mb-1 block font-bold">Email or username</span>
        <input
          className="field py-2 text-sm"
          autoComplete="off"
          value={value.username}
          onChange={(e) => onChange({ username: e.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-bold">Password</span>
        <input
          className="field py-2 text-sm"
          type="password"
          autoComplete="off"
          value={value.password}
          onChange={(e) => onChange({ password: e.target.value })}
        />
      </label>
      <details className="col-span-full space-y-3">
        <summary className="cursor-pointer text-sm font-bold text-stamp hover:underline">
          Advanced
        </summary>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-bold">Sign-in page</span>
            <span className="mb-1 block text-xs text-ink-soft">
              Where the sign-in form is, for example /login
            </span>
            <input
              className="field py-2 text-sm"
              value={value.loginPath}
              placeholder="/login"
              onChange={(e) => onChange({ loginPath: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold">Username selector (optional)</span>
            <input
              className="field py-2 text-sm"
              value={value.usernameSelector || ''}
              placeholder='input[name="user"]'
              onChange={(e) => onChange({ usernameSelector: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold">Password selector (optional)</span>
            <input
              className="field py-2 text-sm"
              value={value.passwordSelector || ''}
              placeholder='input[type="password"]'
              onChange={(e) => onChange({ passwordSelector: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold">Submit selector (optional)</span>
            <input
              className="field py-2 text-sm"
              value={value.submitSelector || ''}
              placeholder='button[type="submit"]'
              onChange={(e) => onChange({ submitSelector: e.target.value })}
            />
          </label>
        </div>
      </details>
      {onRemove && (
        <button
          type="button"
          className="btn-link justify-self-start text-sm"
          onClick={onRemove}
        >
          Remove this sign-in
        </button>
      )}
    </fieldset>
  );
}
