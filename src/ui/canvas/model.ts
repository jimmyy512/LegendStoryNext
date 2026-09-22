export type PanelRow =
  | { kind: 'text'; text: string; emphasis?: 'heading' | 'muted' }
  | { kind: 'action'; label: string; action: string; disabled?: boolean; selected?: boolean }
  | { kind: 'input'; value: string; change: (value: string) => void };

export interface GamePanel {
  title: string;
  rows: PanelRow[];
  subtitle?: string;
  dismissible?: boolean;
}

export const paragraph = (text: string): PanelRow => ({ kind: 'text', text });
export const heading = (text: string): PanelRow => ({ kind: 'text', text, emphasis: 'heading' });
export const action = (label: string, action: string): Extract<PanelRow, { kind: 'action' }> => ({
  kind: 'action',
  label,
  action,
});
