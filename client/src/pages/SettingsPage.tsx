import React, { useEffect, useState } from 'react'
import { Eye, EyeOff, Check, Trash2, RefreshCw, ChevronDown, ExternalLink, Wifi, WifiOff } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { settings as settingsApi, type Setting, type ModelOption } from '@/lib/api'

// ── Model picklist ──────────────────────────────────────────────
function ModelSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: ModelOption[]
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const groups = [...new Set(options.map(o => o.group))]
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none text-sm rounded-ios border border-ios-gray-4 px-3 py-1.5 pr-8 bg-ios-gray-6 text-ios-label outline-none focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20"
      >
        <option value="">{placeholder}</option>
        {groups.map(g => (
          <optgroup key={g} label={g}>
            {options.filter(o => o.group === g).map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
    </div>
  )
}

// ── Editable text/password row ─────────────────────────────────
function SettingRow({
  setting,
  onSave,
  onClear,
}: {
  setting: Setting
  onSave: (key: string, value: string) => Promise<void>
  onClear: (key: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(setting.key, value)
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setValue('')
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = async () => {
    if (!confirm(`Remove override for ${setting.label}? Will fall back to environment variable.`)) return
    await onClear(setting.key)
  }

  return (
    <div className="py-3 border-b border-ios-gray-5 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ios-label">{setting.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              setting.source === 'override' ? 'bg-ios-green/10 text-ios-green'
              : setting.source === 'env' ? 'bg-blue-50 text-ios-blue'
              : 'bg-ios-gray-5 text-ios-gray-1'
            }`}>
              {setting.source === 'override' ? '✓ Override active'
               : setting.source === 'env' ? 'Using env default'
               : 'Not configured'}
            </span>
            {setting.hasValue && setting.sensitive && (
              <span className="text-xs text-ios-gray-1 font-mono">•••••••••</span>
            )}
            {setting.hasValue && !setting.sensitive && (
              <span className="text-xs text-ios-gray-1 font-mono truncate max-w-32">{setting.value}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {saved && <Check size={14} className="text-ios-green" />}
          {setting.source === 'override' && (
            <button onClick={handleClear} className="p-1.5 text-ios-gray-1 hover:text-ios-red rounded-ios hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setEditing(e => !e)}
            className="text-xs text-ios-blue hover:bg-ios-blue/10 px-2 py-1 rounded-ios transition-colors"
          >
            {editing ? 'Cancel' : 'Set'}
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <input
              type={setting.sensitive && !show ? 'password' : 'text'}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={`Enter ${setting.label}…`}
              className="w-full text-sm rounded-ios border border-ios-gray-4 px-3 py-1.5 bg-ios-gray-6 text-ios-label outline-none font-mono pr-8"
              autoFocus
            />
            {setting.sensitive && (
              <button onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ios-gray-1">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!value.trim()}>Save</Button>
        </div>
      )}
    </div>
  )
}

// ── Picklist row (model selector) ──────────────────────────────
function ModelRow({
  label,
  settingKey,
  currentValue,
  options,
  onSave,
  onClear,
}: {
  label: string
  settingKey: string
  currentValue: string
  options: ModelOption[]
  onSave: (key: string, value: string) => Promise<void>
  onClear: (key: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = async (v: string) => {
    if (!v) { await onClear(settingKey); return }
    setSaving(true)
    await onSave(settingKey, v)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="py-3 border-b border-ios-gray-5 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-ios-label">{label}</p>
        <div className="flex items-center gap-1.5">
          {saving && <span className="text-xs text-ios-gray-1">Saving…</span>}
          {saved && <Check size={13} className="text-ios-green" />}
          {currentValue && (
            <button onClick={() => handleChange('')} className="p-1.5 text-ios-gray-1 hover:text-ios-red rounded-ios hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <ModelSelect
        options={options}
        value={currentValue}
        onChange={handleChange}
        placeholder="— use default —"
      />
      {currentValue && (
        <p className="text-xs text-ios-green mt-1">✓ Override active: {currentValue}</p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
type SectionKey = 'ai' | 'stt'
const SECTION_LABELS: Record<SectionKey, string> = {
  ai: 'AI Provider',
  stt: 'Speech-to-Text (Deepgram)',
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'gemini', label: 'Google Gemini' },
]

export function SettingsPage() {
  const [settingsList, setSettingsList] = useState<Setting[]>([])
  const [geminiModels, setGeminiModels] = useState<ModelOption[]>([])
  const [deepgramModels, setDeepgramModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{ ai: { anthropic: boolean; gemini: boolean; activeProvider: string }; stt: { deepgram: boolean }; fileflow: { configured: boolean; url: string | null } } | null>(null)
  const [ffTesting, setFfTesting] = useState(false)
  const [ffTestResult, setFfTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const load = async () => {
    const [{ settings }, s, models] = await Promise.all([
      settingsApi.list(),
      settingsApi.status(),
      settingsApi.models(),
    ])
    setSettingsList(settings)
    setStatus(s)
    setGeminiModels(models.gemini)
    setDeepgramModels(models.deepgram)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (key: string, value: string) => {
    await settingsApi.update(key, value)
    await load()
  }

  const handleClear = async (key: string) => {
    await settingsApi.delete(key)
    await load()
  }

  const getSetting = (key: string) => settingsList.find(s => s.key === key)

  // API key settings per section (exclude model/provider keys — rendered separately)
  const apiKeySettings = (section: SectionKey) =>
    settingsList.filter(s => s.section === section && s.sensitive)

  const geminiModelSetting = getSetting('GEMINI_MODEL')
  const deepgramModelSetting = getSetting('DEEPGRAM_MODEL')
  const aiProviderSetting = getSetting('AI_PROVIDER')

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Settings"
        actions={
          <button onClick={load} className="p-2 text-ios-gray-1 hover:bg-ios-gray-5 rounded-ios transition-colors">
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-2xl">
        {/* Status banner */}
        {status && (
          <div className="flex items-center gap-4 bg-white rounded-ios-lg p-4 shadow-ios text-sm">
            <div className={`flex items-center gap-1.5 ${status.ai.anthropic || status.ai.gemini ? 'text-ios-green' : 'text-ios-red'}`}>
              <div className={`w-2 h-2 rounded-full ${status.ai.anthropic || status.ai.gemini ? 'bg-ios-green' : 'bg-ios-red'}`} />
              AI: {status.ai.activeProvider !== 'none' ? status.ai.activeProvider : 'not configured'}
            </div>
            <div className={`flex items-center gap-1.5 ${status.stt.deepgram ? 'text-ios-green' : 'text-ios-red'}`}>
              <div className={`w-2 h-2 rounded-full ${status.stt.deepgram ? 'bg-ios-green' : 'bg-ios-red'}`} />
              Deepgram: {status.stt.deepgram ? 'configured' : 'not configured'}
            </div>
            <div className={`flex items-center gap-1.5 ${status.fileflow?.configured ? 'text-ios-green' : 'text-ios-gray-1'}`}>
              <div className={`w-2 h-2 rounded-full ${status.fileflow?.configured ? 'bg-ios-green' : 'bg-ios-gray-3'}`} />
              FileFlow: {status.fileflow?.configured ? 'connected' : 'not configured'}
            </div>
          </div>
        )}

        {/* AI Provider section */}
        {!loading && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-ios-label">{SECTION_LABELS.ai}</h2>
            </CardHeader>
            <CardBody className="p-0">
              <div className="px-4">
                {/* API keys */}
                {apiKeySettings('ai').map(s => (
                  <SettingRow key={s.key} setting={s} onSave={handleSave} onClear={handleClear} />
                ))}

                {/* Active provider picker */}
                {aiProviderSetting && (
                  <ModelRow
                    label="Active AI Provider"
                    settingKey="AI_PROVIDER"
                    currentValue={aiProviderSetting.value}
                    options={PROVIDERS.map(p => ({ id: p.id, label: p.label, group: 'Providers' }))}
                    onSave={handleSave}
                    onClear={handleClear}
                  />
                )}

                {/* Gemini model picker */}
                {geminiModelSetting && geminiModels.length > 0 && (
                  <ModelRow
                    label="Gemini Model"
                    settingKey="GEMINI_MODEL"
                    currentValue={geminiModelSetting.value}
                    options={geminiModels}
                    onSave={handleSave}
                    onClear={handleClear}
                  />
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* STT section */}
        {!loading && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-ios-label">{SECTION_LABELS.stt}</h2>
            </CardHeader>
            <CardBody className="p-0">
              <div className="px-4">
                {apiKeySettings('stt').map(s => (
                  <SettingRow key={s.key} setting={s} onSave={handleSave} onClear={handleClear} />
                ))}

                {/* Deepgram model picker */}
                {deepgramModelSetting && deepgramModels.length > 0 && (
                  <ModelRow
                    label="Deepgram STT Model"
                    settingKey="DEEPGRAM_MODEL"
                    currentValue={deepgramModelSetting.value}
                    options={deepgramModels}
                    onSave={handleSave}
                    onClear={handleClear}
                  />
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* FileFlow integration section */}
        {!loading && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ios-label">FileFlow Storage</h2>
              {status?.fileflow?.url && (
                <a
                  href={status.fileflow.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-ios-blue hover:underline"
                >
                  Open FileFlow <ExternalLink size={11} />
                </a>
              )}
            </CardHeader>
            <CardBody className="p-0">
              <div className="px-4">
                <p className="text-xs text-ios-gray-1 py-2 border-b border-ios-gray-5">
                  Audio recordings and transcripts will automatically be saved to FileFlow after each recording.
                  Both the audio file and a companion transcript .txt will appear in your FileFlow library.
                </p>
                {settingsList.filter(s => s.section === 'fileflow').map(s => (
                  <SettingRow key={s.key} setting={s} onSave={handleSave} onClear={handleClear} />
                ))}

                {/* Test connection button */}
                <div className="py-3">
                  <Button
                    size="sm"
                    onClick={async () => {
                      setFfTesting(true)
                      setFfTestResult(null)
                      const url = settingsList.find(s => s.key === 'FILEFLOW_URL')?.value ?? ''
                      const email = settingsList.find(s => s.key === 'FILEFLOW_EMAIL')?.value ?? ''
                      // password is masked so pass empty — server will use DB value
                      const result = await settingsApi.testFileFlow(url, email, '')
                      setFfTestResult(result)
                      setFfTesting(false)
                    }}
                    loading={ffTesting}
                    disabled={!settingsList.find(s => s.key === 'FILEFLOW_URL')?.hasValue}
                  >
                    Test Connection
                  </Button>
                  {ffTestResult && (
                    <div className={`flex items-center gap-2 mt-2 text-xs ${ffTestResult.ok ? 'text-ios-green' : 'text-ios-red'}`}>
                      {ffTestResult.ok ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {ffTestResult.ok ? 'Connected successfully' : ffTestResult.error}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader><h2 className="text-sm font-semibold">About</h2></CardHeader>
          <CardBody>
            <p className="text-xs text-ios-gray-1">ListFlow v0.1.0</p>
            <p className="text-xs text-ios-gray-1 mt-1">Notion-like workspace with audio + AI</p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
