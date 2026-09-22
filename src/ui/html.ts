export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

export function portrait(color = '#99a99a', variant = 'hero'): string {
  return `<svg viewBox="0 0 180 220" aria-hidden="true" class="portrait-art"><defs><linearGradient id="portrait-bg-${variant}" x2="0" y2="1"><stop stop-color="#476159"/><stop offset="1" stop-color="#233c35"/></linearGradient></defs><rect width="180" height="220" fill="url(#portrait-bg-${variant})"/><circle cx="90" cy="84" r="65" fill="none" stroke="#cbb583" stroke-opacity=".25"/><path d="M0 182 30 152 46 161 80 121 125 155 155 133 180 155V220H0" fill="#8a9b80" opacity=".15"/><path d="M27 220 38 149 66 130 112 132 147 161 163 220" fill="${color}"/><path d="M65 130 90 170 111 131 99 220H70Z" fill="#e7dfc6"/><path d="m66 132 24 38-17 25-29-49m67-14-21 38 20 24 22-47" fill="none" stroke="#627568" stroke-width="4"/><path d="M58 79q-2-43 35-40 39 2 32 50l-8 31-26 22-26-22Z" fill="#dbc19d"/><path d="M57 87q-10-41 9-50 1-22 29-15 26 0 33 31l-3 38-10-26q-28 7-44-10l-7 32" fill="#26322f"/><path d="M76 26q-5-22 12-24 26-3 17 28" fill="#26322f"/><path d="m69 80 14-2m18 0 14 2" stroke="#484d3e" stroke-width="3"/><path d="m88 106 12 0" stroke="#a17b60" stroke-width="2"/><path d="M56 46q30-15 68 1" fill="none" stroke="#c2a66a" stroke-width="5"/><path d="m45 220-5-85m-12 3 26-3" stroke="#bca36f" stroke-width="5"/><path d="M130 49q22 22 20 51" fill="none" stroke="#c2a66a" stroke-width="3"/></svg>`;
}

export function meter(label: string, value: number, max: number, type = 'hp'): string {
  return `<div class="meter ${type}"><div class="meter-heading"><span>${label}</span><span>${value}<small> / ${max}</small></span></div><div class="meter-track"><i style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></i></div></div>`;
}

export function button(label: string, action: string, className = '', disabled = false): string {
  return `<button type="button" class="${className}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}
