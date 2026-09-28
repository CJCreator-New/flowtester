import { useState } from 'react';
import type { RoleCredential } from '@qa/types';
import { ErrorMessage, Lead, Question } from '../components/Shell';

export interface RoleRow extends RoleCredential {
  /** Stable key for React; never sent to the runner. */
  key: number;
}

let nextKey = 1;
export const newRoleRow = (): RoleRow => ({ key: nextKey++, role: '', username: '', password: '', loginPath: '/login' });

/** Strips the UI-only key: exactly the shape /api/runner/run accepts. */
export function toRoleCredentials(rows: RoleRow[]): RoleCredential[] {
  return rows.map(({ role, username, password, loginPath }) => ({
    role: role.trim(),
    username: username.trim(),
    password,
    loginPath: loginPath?.trim() || '/login',
  }));
}

export function RolesStep({
  rows,
  onChange,
  onBack,
  onNext,
}: {
  rows: RoleRow[];
  onChange: (rows: RoleRow[]) => void;
  onBack: () => void;
  onNext: (rows: RoleRow[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<RoleRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const next = () => {
    const incomplete = rows.findIndex((r) => !r.role.trim() || !r.username.trim());
    if (incomplete >= 0) {
      setError(`Sign-in ${incomplete + 1} needs a name for the type of user and a username or email.`);
      return;
    }
    const names = rows.map((r) => r.role.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Give each sign-in a different name, like “admin” and “customer”.');
      return;
    }
    setError(null);
    onNext(rows);
  };

  return (
    <section className="max-w-prose">
      <Question>Do you need to sign in to test it?</Question>
      <Lead>
        If parts of your product are only visible after signing in, add a test account for each type of user. These details
        are only used for this check and aren’t saved.
      </Lead>

      {rows.length === 0 ? (
        <div className="flex flex-wrap gap-4">
          <button type="button" className="btn-primary" onClick={() => onNext([])}>
            No, skip this step
          </button>
          <button type="button" className="btn-quiet" onClick={() => onChange([newRoleRow()])}>
            Yes, add sign-in details
          </button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <ol className="space-y-6">
            {rows.map((row, i) => (
              <li key={row.key}>
                <fieldset className="rounded-lg border-2 border-edge bg-surface p-5">
                  <legend className="px-2 font-bold">Sign-in {i + 1}</legend>
                  <div className="grid items-end gap-4 sm:grid-cols-2">
                    <Field
                      id={`role-${row.key}`}
                      label="Type of user"
                      hint="For example admin or customer"
                      value={row.role}
                      onChange={(v) => update(row.key, { role: v })}
                    />
                    <Field
                      id={`username-${row.key}`}
                      label="Username or email"
                      value={row.username}
                      autoComplete="off"
                      onChange={(v) => update(row.key, { username: v })}
                    />
                    <Field
                      id={`password-${row.key}`}
                      label="Password"
                      type="password"
                      autoComplete="new-password"
                      value={row.password ?? ''}
                      onChange={(v) => update(row.key, { password: v })}
                    />
                    <Field
                      id={`login-${row.key}`}
                      label="Sign-in page"
                      hint="The part after your site’s address"
                      value={row.loginPath ?? ''}
                      onChange={(v) => update(row.key, { loginPath: v })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-link mt-3"
                    onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                    aria-label={`Remove sign-in ${i + 1}${row.role ? ` (${row.role})` : ''}`}
                  >
                    Remove this sign-in
                  </button>
                </fieldset>
              </li>
            ))}
          </ol>

          <button type="button" className="btn-link mt-4" onClick={() => onChange([...rows, newRoleRow()])}>
            Add another sign-in
          </button>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="submit" className="btn-primary">
              Next
            </button>
            <button type="button" className="btn-link" onClick={onBack}>
              Back
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 && (
        <button type="button" className="btn-link mt-6" onClick={onBack}>
          Back
        </button>
      )}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="hint -mt-1 mb-2 text-base">
          {hint}
        </p>
      )}
      <input
        id={id}
        className="field"
        type={type}
        value={value}
        autoComplete={autoComplete}
        spellCheck={false}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
