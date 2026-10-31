import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Accordion,
  Button,
  Checkbox,
  ColorGrid,
  Disclosure,
  DropdownSelect,
  Slider,
  Stepper,
  TextField,
  ToggleSwitch,
  addDesignTokenStylesToDocument
} from '@tableau/tableau-ui';
import type { RaincloudOptions } from '../chart/options';
import {
  BINS, CLOUDS, RAINS, SIZE_MODES, SMOOTHING_STEPS, WRAP_CHOICES, parsePercentiles, sliderFromSmoothing, smoothingFromSlider, startDialog, type DialogSession
} from './shared';

// Format dialog prototype A: Tableau's own React component library (as Tableau's Sankey and Table do).

function FormatDialog({ session }: { session: DialogSession }) {
  const [o, setO] = useState<RaincloudOptions>(session.options);
  const [pctText, setPctText] = useState(o.markers.percentiles.join(', '));
  // 'closing' while Done waits; 'stuck' if Tableau didn't close the window (seen under sandbox hosting).
  const [closing, setClosing] = useState<'idle' | 'closing' | 'stuck'>('idle');
  const done = () => {
    setClosing('closing');
    void session.close();
    window.setTimeout(() => setClosing('stuck'), 1200);
  };
  const set = (next: RaincloudOptions) => { setO(next); session.update(next); };

  return (
    <div className="dlg">
      <Accordion showDividers>
        <Disclosure label="Cloud" isInitiallyExpanded>
          <div className="stack">
            <DropdownSelect kind="outline" label="Shape" value={o.cloud}
              onChange={(e) => set({ ...o, cloud: e.target.value as RaincloudOptions['cloud'] })}>
              {CLOUDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </DropdownSelect>
            {o.cloud === 'density' && (
              <Slider type="single-value" label={`Smoothing: ${o.bandwidth.toFixed(2)}× (less ← → more)`} min={0} max={SMOOTHING_STEPS}
                value={sliderFromSmoothing(o.bandwidth)} onChange={(v) => set({ ...o, bandwidth: smoothingFromSlider(v) })} />
            )}
            {o.cloud === 'histogram' && (
              <DropdownSelect kind="outline" label="Bins" value={String(o.bins)}
                onChange={(e) => set({ ...o, bins: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}>
                {BINS.map((b) => <option key={b} value={b}>{b === 'auto' ? 'Automatic' : b}</option>)}
              </DropdownSelect>
            )}
          </div>
        </Disclosure>
        <Disclosure label="Rain" isInitiallyExpanded>
          <div className="stack">
            <DropdownSelect kind="outline" label="Points" value={o.rain}
              onChange={(e) => set({ ...o, rain: e.target.value as RaincloudOptions['rain'] })}>
              {RAINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </DropdownSelect>
          </div>
        </Disclosure>
        <Disclosure label="Summary" isInitiallyExpanded>
          <div className="stack">
            <Checkbox checked={o.lightning === 'box'} onChange={(e) => set({ ...o, lightning: e.target.checked ? 'box' : 'none' })}>
              Box plot
            </Checkbox>
            <Checkbox checked={o.markers.mean} onChange={(e) => set({ ...o, markers: { ...o.markers, mean: e.target.checked } })}>
              Mean marker
            </Checkbox>
            <TextField kind="line" label="Percentile markers" placeholder="e.g. 10, 90" value={pctText}
              onChange={(e) => { setPctText(e.target.value); set({ ...o, markers: { ...o.markers, percentiles: parsePercentiles(e.target.value) } }); }} />
            <Checkbox checked={o.markers.showValues} onChange={(e) => set({ ...o, markers: { ...o.markers, showValues: e.target.checked } })}>
              Show values on markers
            </Checkbox>
            <Stepper label="Decimal places" min={0} max={6} step={1} value={o.markers.decimals}
              onValueChange={(v) => set({ ...o, markers: { ...o.markers, decimals: v } })} />
          </div>
        </Disclosure>
        <Disclosure label="Axis" isInitiallyExpanded>
          <div className="stack">
            <ToggleSwitch checked={o.axis.range !== 'data'}
              onChange={(e) => set({ ...o, axis: { ...o.axis, range: e.target.checked ? 'whiskers' : 'data' } })}>
              Cut outliers from the axis
            </ToggleSwitch>
            {o.axis.range !== 'data' && (
              <>
                <DropdownSelect kind="outline" label="Cut at" value={o.axis.range}
                  onChange={(e) => set({ ...o, axis: { ...o.axis, range: e.target.value as 'whiskers' | 'percentile' } })}>
                  <option value="whiskers">Whiskers + margin</option>
                  <option value="percentile">Percentiles</option>
                </DropdownSelect>
                {o.axis.range === 'whiskers' ? (
                  <Stepper label="Margin (%)" min={0} max={50} step={1} value={Math.round(o.axis.margin * 100)}
                    onValueChange={(v) => set({ ...o, axis: { ...o.axis, margin: v / 100 } })} />
                ) : (
                  <div className="row">
                    <Stepper label="Low" min={0} max={49} step={0.5} floatingPoint value={o.axis.low}
                      onValueChange={(v) => set({ ...o, axis: { ...o.axis, low: v } })} />
                    <Stepper label="High" min={51} max={100} step={0.5} floatingPoint value={o.axis.high}
                      onValueChange={(v) => set({ ...o, axis: { ...o.axis, high: v } })} />
                  </div>
                )}
                <p className="note">Statistics always use all values; values outside the axis are counted at the edges.</p>
              </>
            )}
          </div>
        </Disclosure>
        <Disclosure label="Layout">
          <div className="stack">
            <DropdownSelect kind="outline" label="Size" value={o.size.mode}
              onChange={(e) => set({ ...o, size: { ...o.size, mode: e.target.value as RaincloudOptions['size']['mode'] } })}>
              {SIZE_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </DropdownSelect>
            {(o.size.mode === 'fitWidth' || o.size.mode === 'standard') && (
              <Stepper label="Row height (px)" min={o.size.minRowHeight} max={400} step={10} value={o.size.rowHeight}
                onValueChange={(v) => set({ ...o, size: { ...o.size, rowHeight: v } })} />
            )}
            {(o.size.mode === 'fitHeight' || o.size.mode === 'standard') && (
              <Stepper label="Panel width (px)" min={o.size.minPanelWidth} max={2000} step={20} value={o.size.panelWidth}
                onValueChange={(v) => set({ ...o, size: { ...o.size, panelWidth: v } })} />
            )}
            <p className="note">Rows never get smaller than {o.size.minRowHeight} px; the chart scrolls instead.</p>
            <DropdownSelect kind="outline" label="Panels per row (one Columns field)" value={String(o.panels.wrap)}
              onChange={(e) => set({ ...o, panels: { ...o.panels, wrap: e.target.value === 'auto' ? 'auto' : Number(e.target.value) } })}>
              {WRAP_CHOICES.map((v) => <option key={v} value={v}>{v === 'auto' ? 'Automatic' : v}</option>)}
            </DropdownSelect>
            <DropdownSelect kind="outline" label="Axis across panels" value={o.panels.axis}
              onChange={(e) => set({ ...o, panels: { ...o.panels, axis: e.target.value as RaincloudOptions['panels']['axis'] } })}>
              <option value="shared">Shared (comparable)</option>
              <option value="independent">Independent per column</option>
            </DropdownSelect>
          </div>
        </Disclosure>
        <Disclosure label="Colour">
          <div className="stack">
            <ColorGrid aria-label="Mark colour" palette="dark" selectedColor={o.color} onColorChange={(c) => set({ ...o, color: c })} />
            <p className="note">Used when the Colour tile is empty. With a Colour field, dots take Tableau's palette and the cloud turns grey.</p>
            <Checkbox checked={o.colour.splitCloud} onChange={(e) => set({ ...o, colour: { ...o.colour, splitCloud: e.target.checked } })}>
              Split cloud by colour (curves scaled by share; histogram stacks)
            </Checkbox>
            <Checkbox checked={o.colour.showLegend} onChange={(e) => set({ ...o, colour: { ...o.colour, showLegend: e.target.checked } })}>
              Show legend
            </Checkbox>
          </div>
        </Disclosure>
      </Accordion>
      {closing === 'stuck' && (
        <p className="note close-note" role="status">Your changes are saved. Close this window with its × button.</p>
      )}
      <div className="actions">
        <Button kind="outline" onClick={() => { const d = session.reset(); setO(d); setPctText(''); }}>Reset</Button>
        <Button kind="primary" disabled={closing === 'closing'} onClick={done}>{closing === 'closing' ? 'Closing…' : 'Done'}</Button>
      </div>
    </div>
  );
}

addDesignTokenStylesToDocument();
startDialog()
  .then((session) => createRoot(document.getElementById('root')!).render(<FormatDialog session={session} />))
  .catch((err) => {
    console.error('[format] init failed', err);
    document.getElementById('root')!.textContent = `Could not open the Format dialog: ${err}`;
  });
