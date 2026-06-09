// User-adjustable appearance preferences (scale, font size, spacing).
//
// Persisted in localStorage only (per device). The actual CSS application also
// happens in a tiny inline script in index.html so the saved values are applied
// before React mounts (no flash). Keep the VALUE TABLES below in sync with that
// inline script.

const STORAGE_KEYS = {
  scale: 'rs-advocacia-ui-scale',
  font: 'rs-advocacia-font-scale',
  space: 'rs-advocacia-space-scale',
};

// Each group: which CSS variable it drives, the default preset id, and the
// ordered presets (id -> { label, value }). `value` is the multiplier.
export const APPEARANCE = {
  scale: {
    label: 'Escala da interface',
    cssVar: '--ui-scale',
    dataAttr: 'data-scale',
    storageKey: STORAGE_KEYS.scale,
    default: 'default',
    presets: [
      { id: 'compact', label: 'Compacta', value: 0.9 },
      { id: 'default', label: 'Padrão', value: 1 },
      { id: 'wide', label: 'Ampla', value: 1.08 },
    ],
  },
  font: {
    label: 'Tamanho da fonte',
    cssVar: '--font-scale',
    dataAttr: 'data-font',
    storageKey: STORAGE_KEYS.font,
    default: 'md',
    presets: [
      { id: 'sm', label: 'Pequena', value: 0.92 },
      { id: 'md', label: 'Média', value: 1 },
      { id: 'lg', label: 'Grande', value: 1.12 },
    ],
  },
  space: {
    label: 'Espaçamento',
    cssVar: '--space-scale',
    dataAttr: 'data-space',
    storageKey: STORAGE_KEYS.space,
    default: 'default',
    presets: [
      { id: 'tight', label: 'Compacto', value: 0.85 },
      { id: 'default', label: 'Padrão', value: 1 },
      { id: 'comfy', label: 'Confortável', value: 1.2 },
    ],
  },
};

export const APPEARANCE_GROUPS = Object.keys(APPEARANCE);

export const DEFAULT_APPEARANCE = APPEARANCE_GROUPS.reduce((acc, group) => {
  acc[group] = APPEARANCE[group].default;
  return acc;
}, {});

function presetById(group, id) {
  const cfg = APPEARANCE[group];
  return cfg.presets.find((preset) => preset.id === id) || cfg.presets.find((preset) => preset.id === cfg.default);
}

// Read the saved preset ids, falling back to defaults for missing/invalid values.
export function readAppearance() {
  const result = { ...DEFAULT_APPEARANCE };
  if (typeof localStorage === 'undefined') {
    return result;
  }

  for (const group of APPEARANCE_GROUPS) {
    const cfg = APPEARANCE[group];
    const stored = localStorage.getItem(cfg.storageKey);
    if (stored && cfg.presets.some((preset) => preset.id === stored)) {
      result[group] = stored;
    }
  }

  return result;
}

// Apply the given preset ids to <html> (CSS vars + data-attrs) and persist them.
export function applyAppearance(appearance) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  for (const group of APPEARANCE_GROUPS) {
    const cfg = APPEARANCE[group];
    const id = appearance[group] || cfg.default;
    const preset = presetById(group, id);
    root.style.setProperty(cfg.cssVar, String(preset.value));
    root.setAttribute(cfg.dataAttr, preset.id);
    try {
      localStorage.setItem(cfg.storageKey, preset.id);
    } catch {
      // localStorage may be unavailable (private mode); CSS vars still applied.
    }
  }
}
