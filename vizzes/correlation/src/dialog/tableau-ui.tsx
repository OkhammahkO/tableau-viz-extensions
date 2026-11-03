import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Accordion,
  Button,
  Checkbox,
  ColorGrid,
  Disclosure,
  DropdownSelect,
  Stepper,
  TextField,
  ToggleSwitch,
  addDesignTokenStylesToDocument
} from '@tableau/tableau-ui';
import type { CorrOptions } from '../chart/options';
import { parsePercentiles, startDialog, type DialogSession } from './shared';

// The Format dialog: Tableau's own React component library, live preview via settings, sections in the chart's order
// (coefficients above the diagonal, scatters below, histograms on it), like the raincloud's dialog.

function FormatDialog({ session }: { session: DialogSession }) {
  const [o, setO] = useState<CorrOptions>(session.options);
  const [pctText, setPctText] = useState(o.markers.percentiles.join(', '));
  // 'closing' while Done waits; 'stuck' if Tableau didn't close the window (seen under sandbox hosting).
  const [closing, setClosing] = useState<'idle' | 'closing' | 'stuck'>('idle');
  const done = () => {
    setClosing('closing');
    void session.close();
    window.setTimeout(() => setClosing('stuck'), 1200);
  };
  const set = (next: CorrOptions) => { setO(next); session.update(next); };

  return (
    <div className="dlg">
      <Accordion showDividers>
        <Disclosure label="Coefficients (above the diagonal)" isInitiallyExpanded>
          <div className="stack">
            <DropdownSelect kind="outline" label="Coefficient" value={o.coefficient}
              onChange={(e) => set({ ...o, coefficient: e.target.value as CorrOptions['coefficient'] })}>
              <option value="pearson">Pearson r (straight-line relationships)</option>
              <option value="spearman">Spearman ρ (rank-based: robust to outliers and curves)</option>
            </DropdownSelect>
            <DropdownSelect kind="outline" label="Show as" value={o.upper}
              onChange={(e) => set({ ...o, upper: e.target.value as CorrOptions['upper'] })}>
              <option value="number">Number sized by strength</option>
              <option value="tile">Shaded tile with the number</option>
              <option value="plain">Plain number</option>
              <option value="blank">Nothing (hover still shows it)</option>
            </DropdownSelect>
            <DropdownSelect kind="outline" label="Colour" value={o.coefColour}
              onChange={(e) => set({ ...o, coefColour: e.target.value as CorrOptions['coefColour'] })}>
              <option value="auto">Automatic (red/blue unless a Colour field is used)</option>
              <option value="diverging">Always red (negative) / blue (positive)</option>
              <option value="neutral">Always neutral grey</option>
            </DropdownSelect>
            <p className="note">Hover a coefficient for what it means in words, r and ρ, n, the line's formula and r per colour; click it to look closer.</p>
          </div>
        </Disclosure>
        <Disclosure label="Scatters (below the diagonal)">
          <div className="stack">
            <Checkbox checked={o.trendLine} onChange={(e) => set({ ...o, trendLine: e.target.checked })}>
              Trend line (least squares)
            </Checkbox>
            <DropdownSelect kind="outline" label="Formula and R²" value={o.formula}
              onChange={(e) => set({ ...o, formula: e.target.value as CorrOptions['formula'] })}>
              <option value="tooltip">In the tooltip</option>
              <option value="cell">Also printed in each scatter</option>
            </DropdownSelect>
            <DropdownSelect kind="outline" label="Points" value={o.points}
              onChange={(e) => set({ ...o, points: e.target.value as CorrOptions['points'] })}>
              <option value="auto">Automatic (density cells for big data)</option>
              <option value="points">Always every point</option>
              <option value="density">Always density cells</option>
            </DropdownSelect>
            {o.points === 'auto' && (
              <Stepper label="Density cells above (records)" min={500} max={200000} step={500} value={o.densityThreshold}
                onValueChange={(v) => set({ ...o, densityThreshold: v })} />
            )}
          </div>
        </Disclosure>
        <Disclosure label="Histograms (on the diagonal)">
          <div className="stack">
            <DropdownSelect kind="outline" label="Show" value={o.diag}
              onChange={(e) => set({ ...o, diag: e.target.value as CorrOptions['diag'] })}>
              <option value="histogram">Histogram (bars)</option>
              <option value="density">Density (smooth curve)</option>
            </DropdownSelect>
            <DropdownSelect kind="outline" label="Split by colour" value={o.diagSplit}
              onChange={(e) => set({ ...o, diagSplit: e.target.value as CorrOptions['diagSplit'] })}>
              <option value="each">Each colour = 100% (compare shapes)</option>
              <option value="share">Share of the whole (stacked)</option>
              <option value="off">Off (one histogram)</option>
            </DropdownSelect>
            <Checkbox checked={o.diagBox} onChange={(e) => set({ ...o, diagBox: e.target.checked })}>
              Box plot under each histogram
            </Checkbox>
            {o.diagBox && (
              <DropdownSelect kind="outline" label="Box" value={o.diagBoxMode}
                onChange={(e) => set({ ...o, diagBoxMode: e.target.value as CorrOptions['diagBoxMode'] })}>
                <option value="combined">One box (all records)</option>
                <option value="colour">One per colour (2–4 colours)</option>
              </DropdownSelect>
            )}
          </div>
        </Disclosure>
        <Disclosure label="Markers (on the boxes)">
          <div className="stack">
            <Checkbox checked={o.markers.mean} onChange={(e) => set({ ...o, markers: { ...o.markers, mean: e.target.checked } })}>
              Mean (orange circle)
            </Checkbox>
            <TextField kind="line" label="Percentiles" placeholder="e.g. 5, 95" value={pctText}
              onChange={(e) => { setPctText(e.target.value); set({ ...o, markers: { ...o.markers, percentiles: parsePercentiles(e.target.value) } }); }} />
            <Checkbox checked={o.markers.showValues} onChange={(e) => set({ ...o, markers: { ...o.markers, showValues: e.target.checked } })}>
              Show values in the focus view
            </Checkbox>
            <DropdownSelect kind="outline" label="Decimal places" value={String(o.markers.decimals)}
              onChange={(e) => { const d = e.target.value; set({ ...o, markers: { ...o.markers, decimals: d === 'auto' || d === 'field' ? d : Number(d) } }); }}>
              <option value="auto">Automatic (suits the data's spread)</option>
              <option value="field">As the field's format</option>
              {[0, 1, 2, 3, 4].map((d) => <option key={d} value={d}>{d}</option>)}
            </DropdownSelect>
            <p className="note">The matrix's small boxes show the values when you hover them.</p>
          </div>
        </Disclosure>
        <Disclosure label="Outliers">
          <div className="stack">
            <ToggleSwitch checked={o.axisCut.on} onChange={(e) => set({ ...o, axisCut: { ...o.axisCut, on: e.target.checked } })}>
              Cut outliers from the axes
            </ToggleSwitch>
            {o.axisCut.on && (
              <Stepper label="Margin beyond the whiskers (%)" min={0} max={50} step={1} value={Math.round(o.axisCut.margin * 100)}
                onValueChange={(v) => set({ ...o, axisCut: { ...o.axisCut, margin: v / 100 } })} />
            )}
            <p className="note">Correlations, boxes and counts always use all values. Values beyond an axis are counted on the
              histograms, and a badge lets viewers show them all.</p>
          </div>
        </Disclosure>
        <Disclosure label="Colour">
          <div className="stack">
            <div>
              <p className="field-label">Mark colour</p>
              <ColorGrid aria-label="Mark colour" palette="dark" selectedColor={o.color} onColorChange={(c) => set({ ...o, color: c })} />
            </div>
            <p className="note">Used when the Colour tile is empty. With a Colour field, points and histograms take Tableau's palette.</p>
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
        <Button kind="outline" onClick={() => { const d = session.reset(); setO(d); setPctText(d.markers.percentiles.join(', ')); }}>Reset</Button>
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
