import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, FeatureGroup, Polygon, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { api } from '../api/client';

type Scheme = {
  scheme_id: string;
  scheme_name: string;
  description: string;
  benefit_amount: number;
  crop_required: string;
  min_land_hectares: number;
};

type DemoParcel = {
  parcel_id: string;
  state: string;
  district: string;
  taluka: string;
  survey_no: string;
  polygon: { type: 'Polygon'; coordinates: number[][][] };
  total_hectares: number;
  owner_name: string;
  classification: string;
  soil_type: string;
  irrigation_source: string;
  crop_history: { season: string; crop: string }[];
};

const CROPS = ['wheat', 'rice', 'sugarcane', 'maize', 'cotton', 'pulses', 'vegetables', 'other'];

function FlyTo({ polygon }: { polygon: { coordinates: number[][][] } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!polygon) return;
    const ring = polygon.coordinates[0];
    const latlngs = ring.map(([lng, lat]) => [lat, lng]) as [number, number][];
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { maxZoom: 17 });
  }, [polygon, map]);
  return null;
}

export default function ApplyWizard() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [form, setForm] = useState({ declared_land_ha: '', annual_income: '', crop_type: 'wheat' });
  const [polygon, setPolygon] = useState<{ type: 'Polygon'; coordinates: number[][][] } | null>(null);
  const [demoParcels, setDemoParcels] = useState<DemoParcel[]>([]);
  const [pickedParcelId, setPickedParcelId] = useState<string>('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fgRef = useRef<L.FeatureGroup>(null);

  useEffect(() => {
    if (step !== 2) return;
    const land = Number(form.declared_land_ha || 1);
    api.get('/schemes/recommend', { params: { declared_land_ha: land, crop_type: form.crop_type } })
      .then((r) => setSchemes(r.data))
      .catch((ex) => setErr(ex?.response?.data?.detail ?? t('apply.schemeCard.failedSchemes')));
  }, [step, form.crop_type, form.declared_land_ha, t]);

  useEffect(() => {
    if (step !== 3) return;
    api.get('/demo/parcels').then((r) => setDemoParcels(r.data)).catch(() => {});
  }, [step]);

  const onCreated = (e: any) => {
    const latlngs = e.layer.getLatLngs()[0] as L.LatLng[];
    const ring = latlngs.map((p) => [p.lng, p.lat]);
    ring.push(ring[0]);
    setPolygon({ type: 'Polygon', coordinates: [ring] });
    setPickedParcelId('');
  };

  const pickDemoParcel = (p: DemoParcel) => {
    setPolygon(p.polygon);
    setPickedParcelId(p.parcel_id);
    if (!form.declared_land_ha) {
      setForm((f) => ({ ...f, declared_land_ha: String(p.total_hectares) }));
    }
    if (p.crop_history?.[0]?.crop && CROPS.includes(p.crop_history[0].crop)) {
      setForm((f) => ({ ...f, crop_type: p.crop_history[0].crop }));
    }
  };

  const onSubmit = async () => {
    setErr('');
    if (!selected) return setErr(t('apply.errors.pickScheme'));
    if (!polygon) return setErr(t('apply.errors.drawParcel'));
    if (!form.declared_land_ha) return setErr(t('apply.errors.enterLand'));

    setBusy(true);
    try {
      const { data } = await api.post('/applications/', {
        scheme_id: selected,
        parcel_polygon: polygon,
        declared_land_ha: Number(form.declared_land_ha),
        crop_type: form.crop_type,
        annual_income: Number(form.annual_income || 0),
      });
      nav(`/applications/${data.application_id}`);
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? t('apply.errors.submitFailed'));
    } finally {
      setBusy(false);
    }
  };

  const polygonLatLngs: [number, number][] | undefined = polygon
    ? (polygon.coordinates[0].map(([lng, lat]) => [lat, lng]) as [number, number][])
    : undefined;

  const stepLabels = [
    t('apply.steps.declare'),
    t('apply.steps.scheme'),
    t('apply.steps.parcel'),
    t('apply.steps.review'),
  ];

  return (
    <div className="container">
      <div className="stepper">
        {stepLabels.map((label, i) => (
          <div key={label} className={`step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h3>{t('apply.declareCard.title')}</h3>
          <div className="grid-2">
            <div>
              <label>{t('apply.declareCard.landSize')}</label>
              <input type="number" step="0.01" min="0.1" value={form.declared_land_ha}
                onChange={(e) => setForm({ ...form, declared_land_ha: e.target.value })} />
            </div>
            <div>
              <label>{t('apply.declareCard.cropType')}</label>
              <select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>
                {CROPS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label>{t('apply.declareCard.annualIncome')}</label>
          <input type="number" value={form.annual_income}
            onChange={(e) => setForm({ ...form, annual_income: e.target.value })} />
          <button className="btn btn-primary" style={{ marginTop: 16 }}
            onClick={() => setStep(2)} disabled={!form.declared_land_ha}>{t('apply.declareCard.next')}</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>{t('apply.schemeCard.title')}</h3>
          {err && <div className="error">{err}</div>}
          {schemes.length === 0 && <p className="muted">{t('apply.schemeCard.noneMatching')}</p>}
          <div style={{ display: 'grid', gap: 10 }}>
            {schemes.map((s) => (
              <div
                key={s.scheme_id}
                className="card"
                onClick={() => setSelected(s.scheme_id)}
                style={{
                  cursor: 'pointer',
                  borderColor: selected === s.scheme_id ? 'var(--primary)' : 'var(--border)',
                  margin: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <b>{s.scheme_name}</b>
                    <p className="muted" style={{ margin: '4px 0' }}>{s.description}</p>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {t('apply.schemeCard.crop')}: {s.crop_required} · {t('apply.schemeCard.min')} {s.min_land_hectares} {t('apply.schemeCard.ha')}
                    </span>
                  </div>
                  <span className="badge badge-ok">₹{s.benefit_amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>{t('apply.schemeCard.back')}</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!selected}>{t('apply.schemeCard.next')}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="card">
            <h3>{t('apply.parcelCard.pickTitle')}</h3>
            <p className="muted" style={{ marginTop: 0 }}>{t('apply.parcelCard.pickHelp')}</p>
            <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 6 }}>
              {demoParcels.map((p) => (
                <div
                  key={p.parcel_id}
                  onClick={() => pickDemoParcel(p)}
                  style={{
                    padding: 10,
                    background: pickedParcelId === p.parcel_id ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    border: pickedParcelId === p.parcel_id ? '1px solid var(--primary)' : '1px solid transparent',
                  }}
                >
                  <b>{p.parcel_id}</b> · {p.owner_name} · {p.total_hectares.toFixed(2)} ha
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {p.taluka}, {p.district}, {p.state} · {p.soil_type} · {p.irrigation_source}
                  </span>
                </div>
              ))}
              {demoParcels.length === 0 && <p className="muted">{t('apply.parcelCard.noneSeeded')}</p>}
            </div>
          </div>

          <div className="card">
            <h3>{t('apply.parcelCard.drawTitle')}</h3>
            <MapContainer center={[18.5204, 73.8567]} zoom={7} style={{ height: 420, borderRadius: 8 }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FeatureGroup ref={fgRef as any}>
                <EditControl
                  position="topleft"
                  onCreated={onCreated}
                  draw={{
                    rectangle: false, circle: false, marker: false, circlemarker: false, polyline: false,
                    polygon: { shapeOptions: { color: '#22c55e' } },
                  }}
                />
              </FeatureGroup>
              {polygonLatLngs && <Polygon positions={polygonLatLngs} pathOptions={{ color: '#22c55e', fillOpacity: 0.3 }} />}
              <FlyTo polygon={polygon} />
            </MapContainer>
            {polygon && (
              <p className="muted" style={{ marginTop: 8 }}>
                {pickedParcelId
                  ? <>{t('apply.parcelCard.usingRegistered')} <b>{pickedParcelId}</b>.</>
                  : <>{t('apply.parcelCard.customCaptured')} · {polygon.coordinates[0].length - 1} {t('apply.parcelCard.points')}.</>}
              </p>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>{t('apply.parcelCard.back')}</button>
              <button className="btn btn-primary" onClick={() => setStep(4)} disabled={!polygon}>{t('apply.parcelCard.next')}</button>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <div className="card">
          <h3>{t('apply.reviewCard.title')}</h3>
          <div className="grid-2">
            <div><span className="muted">{t('apply.reviewCard.scheme')}</span><br />{schemes.find((s) => s.scheme_id === selected)?.scheme_name}</div>
            <div><span className="muted">{t('apply.reviewCard.crop')}</span><br />{form.crop_type}</div>
            <div><span className="muted">{t('apply.reviewCard.declaredArea')}</span><br />{form.declared_land_ha} ha</div>
            <div><span className="muted">{t('apply.reviewCard.annualIncome')}</span><br />₹{form.annual_income}</div>
            <div><span className="muted">{t('apply.reviewCard.parcelSource')}</span><br />{pickedParcelId ? <>{t('apply.reviewCard.registered')} · <b>{pickedParcelId}</b></> : t('apply.reviewCard.userDrawn')}</div>
          </div>
          {err && <div className="error">{err}</div>}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)}>{t('apply.reviewCard.back')}</button>
            <button className="btn btn-primary" onClick={onSubmit} disabled={busy}>
              {busy ? t('apply.reviewCard.submitting') : t('apply.reviewCard.submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
