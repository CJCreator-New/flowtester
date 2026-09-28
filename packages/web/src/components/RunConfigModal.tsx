import { useState } from 'react';
import { X, Plus, Trash2, KeyRound, ListChecks } from 'lucide-react';
import type { RoleCredential, TestCase, AIProviderType } from '@qa/types';

export interface RunConfig {
  roles: RoleCredential[];
  mode: 'default' | 'ai' | 'manual';
  aiProvider: AIProviderType;
  apiKey: string;
  aiModel: string;
  specTestCases: TestCase[];
}

interface RunConfigModalProps {
  open: boolean;
  initialConfig: RunConfig;
  onClose: () => void;
  onSave: (config: RunConfig) => void;
}

const EMPTY_ROLE: RoleCredential = { role: '', username: '', password: '', loginPath: '' };

const SPEC_PLACEHOLDER = `[
  {
    "id": "TC-001",
    "flowId": "login-flow",
    "name": "User can log in",
    "role": "admin",
    "startPage": "/login",
    "steps": [
      { "action": "fill", "selector": "input[name=email]", "value": "admin@example.com", "name": "Enter email" },
      { "action": "fill", "selector": "input[name=password]", "value": "secret", "name": "Enter password" },
      { "action": "click", "selector": "button[type=submit]", "name": "Submit login" }
    ],
    "expectations": { "url": { "pattern": "/dashboard" } }
  }
]`;

export function RunConfigModal({ open, initialConfig, onClose, onSave }: RunConfigModalProps) {
  const [roles, setRoles] = useState<RoleCredential[]>(initialConfig.roles.length ? initialConfig.roles : [EMPTY_ROLE]);
  const [mode, setMode] = useState<RunConfig['mode']>(initialConfig.mode);
  const [aiProvider, setAiProvider] = useState<AIProviderType>(initialConfig.aiProvider);
  const [apiKey, setApiKey] = useState(initialConfig.apiKey);
  const [aiModel, setAiModel] = useState(initialConfig.aiModel);
  const [specJson, setSpecJson] = useState(
    initialConfig.specTestCases.length ? JSON.stringify(initialConfig.specTestCases, null, 2) : ''
  );
  const [specError, setSpecError] = useState<string | null>(null);

  if (!open) return null;

  const updateRole = (index: number, patch: Partial<RoleCredential>) => {
    setRoles((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRole = (index: number) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const cleanedRoles = roles.filter((r) => r.role.trim() && r.username.trim());

    let specTestCases: TestCase[] = [];
    if (mode === 'manual') {
      if (!specJson.trim()) {
        setSpecError('Provide at least one test case as JSON.');
        return;
      }
      try {
        const parsed = JSON.parse(specJson);
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of test cases.');
        specTestCases = parsed;
      } catch (err: any) {
        setSpecError(err.message || 'Invalid JSON.');
        return;
      }
    }
    setSpecError(null);

    onSave({
      roles: cleanedRoles,
      mode,
      aiProvider,
      apiKey,
      aiModel,
      specTestCases,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">Run Configuration</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Credentials */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Login Credentials</h3>
            </div>
            <p className="text-[11px] text-zinc-500 mb-3">
              Optional. Add one row per role the test suite should authenticate as before exercising flows.
            </p>
            <div className="space-y-2">
              {roles.map((role, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Role (e.g. admin)"
                    value={role.role}
                    onChange={(e) => updateRole(i, { role: e.target.value })}
                    className="bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  />
                  <input
                    type="text"
                    placeholder="Username / email"
                    value={role.username}
                    onChange={(e) => updateRole(i, { username: e.target.value })}
                    className="bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={role.password || ''}
                    onChange={(e) => updateRole(i, { password: e.target.value })}
                    className="bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  />
                  <input
                    type="text"
                    placeholder="Login path (optional)"
                    value={role.loginPath || ''}
                    onChange={(e) => updateRole(i, { loginPath: e.target.value })}
                    className="bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    onClick={() => removeRole(i)}
                    className="text-zinc-500 hover:text-rose-400 p-1.5"
                    aria-label="Remove role"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRoles((prev) => [...prev, { ...EMPTY_ROLE }])}
              className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
            >
              <Plus className="w-3 h-3" />
              Add role
            </button>
          </section>

          {/* What to check */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">What To Check</h3>
            </div>

            <div className="flex gap-2 mb-3">
              {(['default', 'ai', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    mode === m
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'text-zinc-400 border-zinc-700/60 hover:bg-zinc-800/40'
                  }`}
                >
                  {m === 'default' ? 'Basic Sanity Check' : m === 'ai' ? 'AI-Driven Discovery' : 'Manual Test Spec'}
                </button>
              ))}
            </div>

            {mode === 'default' && (
              <p className="text-[11px] text-zinc-500">
                Runs a single page-load sanity check against the target URL. Pick AI Discovery or Manual Test Spec
                below for real coverage of flows and requirements.
              </p>
            )}

            {mode === 'ai' && (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-500">
                  The AI agent crawls the target, infers user flows, and generates test cases automatically.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as AIProviderType)}
                    className="bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="mock">Mock (no API calls)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Model (optional)"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <input
                  type="password"
                  placeholder="API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            )}

            {mode === 'manual' && (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-500">
                  Paste an array of test cases (spec) describing exactly which flows and expectations to check.
                </p>
                <textarea
                  value={specJson}
                  onChange={(e) => {
                    setSpecJson(e.target.value);
                    setSpecError(null);
                  }}
                  placeholder={SPEC_PLACEHOLDER}
                  rows={10}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-2 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                />
                {specError && <p className="text-[11px] text-rose-400">{specError}</p>}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-zinc-950"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
