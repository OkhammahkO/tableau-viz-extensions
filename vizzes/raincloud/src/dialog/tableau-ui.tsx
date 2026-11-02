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
import { minRowHeight } from '../chart/render';
import {
  BINS, CLOUDS, RAINS, SIZE_MODES, SMOOTHING_STEPS, WRAP_CHOICES, parsePercentiles, parseStep, sliderFromSmoothing, smoothingFromSlider, startDialog, type DialogSession
} from './shared';

// The Format dialog: Tableau's own React component library (as Tableau's Sankey and Table use), live preview via
// settings; opened from Format Extension (see dialog/shared.ts and @kit/ui/dialog).

function FormatDialog({ session }: { session: DialogSession }) {
  const [o, setO] = useState<RaincloudOptions>(session.options);
  const [pctText, setPctText] = useState(o.markers.percentiles.join(', '));
  const [stepText, setStepText] = useState(o.axis.tickStep ? String(o.axis.tickStep) : '');
  const [fixedTicks, setFixedTicks] = useState(o.axis.tickStep > 0);
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
        <Disclosure label="Cloud (distribution shape)" isInitiallyExpanded>
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
            {o.cloud !== 'none' && (
              <>
                <DropdownSelect kind="outline" label="Cloud heights" value={o.scales.cloudHeight}
                  onChange={(e) => set({ ...o, scales: { ...o.scales, cloudHeight: e.target.value as RaincloudOptions['scales']['cloudHeight'] } })}>
                  <option value="independent">Fit each chart (compare shapes)</option>
                  <option value="shared">Comparable across charts</option>
                </DropdownSelect>
                <DropdownSelect kind="outline" label="Peak % label" value={o.scales.cloudLabel}
                  onChange={(e) => set({ ...o, scales: { ...o.scales, cloudLabel: e.target.value as RaincloudOptions['scales']['cloudLabel'] } })}>
                  <option value="auto">When heights fit each chart</option>
                  <option value="on">Always</option>
                  <option value="off">Never</option>
                </DropdownSelect>
                <p className="note">The label gives the share of a chart's records at its peak, e.g. "12% per 10", because
                  fitted heights can't be compared between charts.</p>
              </>
            )}
            <Checkbox checked={o.ecdf} onChange={(e) => set({ ...o, ecdf: e.target.checked })}>
              Cumulative line (share of records ≤ each value)
            </Checkbox>
            {o.ecdf && (
              <p className="note">Its own 0–100% scale, labelled on the right; it crosses 50% at the median. One line per
                colour when the cloud is split. Hover the cloud to read it.</p>
            )}
          </div>
        </Disclosure>
        <Disclosure label="Box & markers">
          <div className="stack">
            <Checkbox checked={o.lightning === 'box'} onChange={(e) => set({ ...o, lightning: e.target.checked ? 'box' : 'none' })}>
              Box plot (median, quartiles, whiskers)
            </Checkbox>
            {o.lightning === 'box' && (
              <DropdownSelect kind="outline" label="Box position" value={o.boxPosition}
                onChange={(e) => set({ ...o, boxPosition: e.target.value as RaincloudOptions['boxPosition'] })}>
                <option value="auto">Automatic (follows Layout → Density)</option>
                <option value="lane">Own lane</option>
                <option value="baseline">On the cloud's baseline</option>
                <option value="inside">Inside the cloud</option>
              </DropdownSelect>
            )}
            <Checkbox checked={o.markers.mean} onChange={(e) => set({ ...o, markers: { ...o.markers, mean: e.target.checked } })}>
              Mean marker
            </Checkbox>
            {o.markers.mean && (
              <div className="row">
                <DropdownSelect kind="outline" label="Shape" value={o.markers.meanStyle}
                  onChange={(e) => set({ ...o, markers: { ...o.markers, meanStyle: e.target.value as RaincloudOptions['markers']['meanStyle'] } })}>
                  <option value="circle">Hollow circle</option>
                  <option value="circle-lift">Circle, lifted off the median</option>
                  <option value="diamond">Hollow diamond</option>
                  <option value="dot">Dot</option>
                  <option value="cross">Cross</option>
                  <option value="triangle">Triangle above the box</option>
                </DropdownSelect>
                <DropdownSelect kind="outline" label="Colour" value={['#f28e2b', '', 'mark'].includes(o.markers.meanColour) ? o.markers.meanColour : '#f28e2b'}
                  onChange={(e) => set({ ...o, markers: { ...o.markers, meanColour: e.target.value } })}>
                  <option value="#f28e2b">Orange</option>
                  <option value="">Same as median</option>
                  <option value="mark">Mark colour</option>
                </DropdownSelect>
              </div>
            )}
            <TextField kind="line" label="Percentile markers" placeholder="e.g. 10, 90" value={pctText}
              onChange={(e) => { setPctText(e.target.value); set({ ...o, markers: { ...o.markers, percentiles: parsePercentiles(e.target.value) } }); }} />
            <Checkbox checked={o.markers.showValues} onChange={(e) => set({ ...o, markers: { ...o.markers, showValues: e.target.checked } })}>
              Show values on markers
            </Checkbox>
            <Stepper label="Decimal places" min={0} max={6} step={1} value={o.markers.decimals}
              onValueChange={(v) => set({ ...o, markers: { ...o.markers, decimals: v } })} />
          </div>
        </Disclosure>
        <Disclosure label="Dots (one per record)">
          <div className="stack">
            <DropdownSelect kind="outline" label="Style" value={o.rain}
              onChange={(e) => set({ ...o, rain: e.target.value as RaincloudOptions['rain'] })}>
              {RAINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </DropdownSelect>
            {o.rain === 'dots' && (
              <p className="note">Dots keep one size in every chart; where a chart has a big pile, its stacks overlap to fit.</p>
            )}
          </div>
        </Disclosure>
        <Disclosure label="Outliers">
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
              </>
            )}
            <p className="note">Statistics always use all values. Values outside the axis are counted at its edges, and a
              badge lets viewers show them all.</p>
          </div>
        </Disclosure>
        <Disclosure label="Axis">
          <div className="stack">
            <DropdownSelect kind="outline" label="Title" value={o.axis.titleMode}
              onChange={(e) => set({ ...o, axis: { ...o.axis, titleMode: e.target.value as RaincloudOptions['axis']['titleMode'] } })}>
              <option value="auto">Automatic (field name)</option>
              <option value="hidden">Hidden</option>
              <option value="custom">Custom</option>
            </DropdownSelect>
            {o.axis.titleMode === 'custom' && (
              <TextField kind="line" label="Title text" placeholder="Field name" value={o.axis.title}
                onChange={(e) => set({ ...o, axis: { ...o.axis, title: e.target.value } })} />
            )}
            <DropdownSelect kind="outline" label="Tick marks" value={fixedTicks ? 'fixed' : o.axis.ticks}
              onChange={(e) => {
                const v = e.target.value;
                setFixedTicks(v === 'fixed');
                if (v === 'fixed') set({ ...o, axis: { ...o.axis, tickStep: parseStep(stepText) } });
                else set({ ...o, axis: { ...o.axis, ticks: v as RaincloudOptions['axis']['ticks'], tickStep: 0 } });
              }}>
              <option value="auto">Automatic</option>
              <option value="fewer">Fewer</option>
              <option value="more">More</option>
              <option value="fixed">Fixed interval</option>
            </DropdownSelect>
            {fixedTicks && (
              <TextField kind="line" label="Interval" placeholder="e.g. 10" value={stepText}
                onChange={(e) => { setStepText(e.target.value); set({ ...o, axis: { ...o.axis, tickStep: parseStep(e.target.value) } }); }} />
            )}
            <Checkbox checked={o.axis.gridlines} onChange={(e) => set({ ...o, axis: { ...o.axis, gridlines: e.target.checked } })}>
              Gridlines
            </Checkbox>
            <DropdownSelect kind="outline" label="Axis range across columns" value={o.panels.axis}
              onChange={(e) => set({ ...o, panels: { ...o.panels, axis: e.target.value as RaincloudOptions['panels']['axis'] } })}>
              <option value="shared">Shared (comparable)</option>
              <option value="independent">Independent per column</option>
            </DropdownSelect>
          </div>
        </Disclosure>
        <Disclosure label="Layout">
          <div className="stack">
            <DropdownSelect kind="outline" label="Density" value={o.density}
              onChange={(e) => set({ ...o, density: e.target.value as RaincloudOptions['density'] })}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact (thinner rows)</option>
              <option value="dense">Dense (many small multiples)</option>
            </DropdownSelect>
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
            <p className="note">Rows never get smaller than {minRowHeight(o)} px; the chart scrolls instead.</p>
            <DropdownSelect kind="outline" label="Panels per row (one Columns field)" value={String(o.panels.wrap)}
              onChange={(e) => set({ ...o, panels: { ...o.panels, wrap: e.target.value === 'auto' ? 'auto' : Number(e.target.value) } })}>
              {WRAP_CHOICES.map((v) => <option key={v} value={v}>{v === 'auto' ? 'Automatic' : v}</option>)}
            </DropdownSelect>
          </div>
        </Disclosure>
        <Disclosure label="Colour">
          <div className="stack">
            <div>
              <p className="field-label">Mark colour</p>
              <ColorGrid aria-label="Mark colour" palette="dark" selectedColor={o.color} onColorChange={(c) => set({ ...o, color: c })} />
            </div>
            <p className="note">Used when the Colour tile is empty. With a Colour field, dots take Tableau's palette and the cloud turns grey.</p>
            <Checkbox checked={o.colour.splitCloud} onChange={(e) => set({ ...o, colour: { ...o.colour, splitCloud: e.target.checked } })}>
              Split cloud by colour
            </Checkbox>
            {o.colour.splitCloud && (
              <DropdownSelect kind="outline" label="Split cloud size" value={o.colour.cloudSizing}
                onChange={(e) => set({ ...o, colour: { ...o.colour, cloudSizing: e.target.value as RaincloudOptions['colour']['cloudSizing'] } })}>
                <option value="each">Each colour = 100% (compare shapes)</option>
                <option value="share">Share of the slice (colours add up)</option>
              </DropdownSelect>
            )}
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
        <Button kind="outline" onClick={() => { const d = session.reset(); setO(d); setPctText(''); setStepText(''); setFixedTicks(false); }}>Reset</Button>
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
