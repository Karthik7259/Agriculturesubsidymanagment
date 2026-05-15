import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../api/client';

type Parcel = {
  parcel_id: string;
  state: string;
  district: string;
  taluka: string;
  polygon: { type: 'Polygon'; coordinates: number[][][] };
  total_hectares: number;
  owner_name: string;
  soil_type: string;
  irrigation_source: string;
  survey_number?: string;
  village?: string;
  location_label?: string;
  centroid?: { lat: number; lng: number };
  source?: string;
};

type Txn = {
  txn_id: string;
  farmer_id: string;
  farmer_name?: string;
  application_id?: string;
  scheme_id?: string;
  amount: number;
  status: string;
  error?: string;
  bank_name?: string;
  npci_ref?: string;
  account_masked?: string;
  balance_after?: number;
  created_at: string;
  source?: string;
};

const PARCEL_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

function locationText(p: Parcel) {
  return p.location_label || [p.village, p.taluka, p.district, p.state].filter(Boolean).join(', ') || 'Location unavailable';
}

function parcelPositions(p: Parcel) {
  return p.polygon?.coordinates?.[0]?.map(
    ([lng, lat]) => [lat, lng] as [number, number],
  ) ?? [];
}

function FitParcels({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();

  useEffect(() => {
    const points = parcels.flatMap(parcelPositions);
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 13 });
  }, [map, parcels]);

  return null;
}

export default function AdminDemoData() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [parcelErr, setParcelErr] = useState('');
  const [ledgerErr, setLedgerErr] = useState('');
  const [parcelSource, setParcelSource] = useState('');
  const [ledgerSource, setLedgerSource] = useState('');

  useEffect(() => {
    api.get('/demo/admin/parcels')
      .then(({ data }) => {
        setParcels(data);
        setParcelSource(data[0]?.source === 'local_db' ? 'MongoDB (fallback)' : 'Land Registry Service');
      })
      .catch((ex) => setParcelErr(ex?.response?.data?.detail ?? 'Cadastral registry unreachable'));

    api.get('/demo/admin/ledger')
      .then(({ data }) => {
        setTxns(data);
        setLedgerSource(data[0]?.source === 'local_db' ? 'MongoDB (fallback)' : 'Bank Service');
      })
      .catch((ex) => setLedgerErr(ex?.response?.data?.detail ?? 'Bank ledger unreachable'));
  }, []);

  const drawableParcels = parcels.filter((p) => parcelPositions(p).length >= 3);

  const center: [number, number] = drawableParcels.length
    ? parcelPositions(drawableParcels[0])[0]
    : [19.0, 75.0];

  const zoom = drawableParcels.length === 1 ? 14 : drawableParcels.length > 0 ? 6 : 5;

  return (
    <div>
      {/* Banner */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1600&q=70"
          alt="Farmland aerial"
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(18,40,92,0.95) 0%, rgba(30,58,95,0.85) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} /><div style={{ flex: 1, background: '#ffffff' }} /><div style={{ flex: 1, background: '#138808' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 32px' }}>
          <div>
            <div style={{ color: '#f5c842', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Admin Panel · Synthetic Dataset Explorer
            </div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0 }}>
              🗺️ Demo Data — Cadastral Registry &amp; Bank Ledger
            </h2>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
              Pre-seeded data powering realistic verification — not stubs
            </div>
          </div>
        </div>
      </div>

      <div className="container">

        {/* ── Cadastral Registry ──────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🏗️</span>
              <div>
                <h3 style={{ margin: 0 }}>Cadastral Registry — {parcels.length} parcels</h3>
                {parcelSource && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Source: {parcelSource}</span>}
              </div>
            </div>
            {parcelErr && (
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontWeight: 600 }}>
                ⚠ {parcelErr}
              </span>
            )}
          </div>

          {parcels.length > 0 && (
            <div style={{ padding: '16px 22px' }}>
              <MapContainer center={center} zoom={zoom} style={{ height: 420, borderRadius: 12 }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitParcels parcels={drawableParcels} />
                {drawableParcels.map((p, i) => {
                  const coords = parcelPositions(p);
                  const color = PARCEL_COLORS[i % PARCEL_COLORS.length];
                  return (
                    <Polygon key={p.parcel_id} positions={coords} pathOptions={{ color, weight: 3, fillOpacity: 0.25 }}>
                      <Tooltip>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.parcel_id}</div>
                        <div>Owner: {p.owner_name}</div>
                        <div>{p.total_hectares.toFixed(2)} ha · {p.soil_type}</div>
                        <div>{locationText(p)}</div>
                        {p.centroid && <div>{p.centroid.lat.toFixed(5)}, {p.centroid.lng.toFixed(5)}</div>}
                        {p.survey_number && <div>Survey: {p.survey_number}</div>}
                        <div>Irrigation: {p.irrigation_source}</div>
                      </Tooltip>
                      <Tooltip permanent direction="center" opacity={0.85}>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{p.parcel_id}</span>
                      </Tooltip>
                    </Polygon>
                  );
                })}
              </MapContainer>
            </div>
          )}

          {parcels.length === 0 && !parcelErr && (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--muted)' }}>
              Loading parcels...
            </div>
          )}

          {/* Parcel table */}
          {parcels.length > 0 && (
            <div style={{ padding: '0 22px 16px', overflowX: 'auto' }}>
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Parcel ID</th>
                    <th>Owner</th>
                    <th>Area</th>
                    <th>Survey No.</th>
                    <th>Soil Type</th>
                    <th>Irrigation</th>
                    <th>Location</th>
                    <th>Map Center</th>
                  </tr>
                </thead>
                <tbody>
                  {parcels.map((p, i) => (
                    <tr key={p.parcel_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: PARCEL_COLORS[i % PARCEL_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{p.parcel_id}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.owner_name}</td>
                      <td><b>{p.total_hectares.toFixed(2)}</b> ha</td>
                      <td>{p.survey_number || '—'}</td>
                      <td>{p.soil_type || '—'}</td>
                      <td>{p.irrigation_source || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{locationText(p)}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {p.centroid ? `${p.centroid.lat.toFixed(5)}, ${p.centroid.lng.toFixed(5)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Bank Ledger ──────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🏦</span>
              <div>
                <h3 style={{ margin: 0 }}>Bank Ledger — {txns.length} transactions</h3>
                {ledgerSource && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Source: {ledgerSource}</span>}
              </div>
            </div>
            {ledgerErr && (
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontWeight: 600 }}>
                ⚠ {ledgerErr}
              </span>
            )}
          </div>

          {txns.length > 0 ? (
            <div style={{ padding: '0 22px 16px', overflowX: 'auto' }}>
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>Farmer</th>
                    <th>Scheme</th>
                    <th>Amount</th>
                    <th>Bank</th>
                    <th>NPCI Ref</th>
                    <th>Status</th>
                    <th>Error</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t2) => (
                    <tr key={t2.txn_id + t2.farmer_id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t2.txn_id || '—'}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t2.farmer_name || t2.farmer_id}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{t2.farmer_id}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{t2.scheme_id?.replace('S-', '') ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>₹{t2.amount?.toLocaleString() ?? '0'}</td>
                      <td style={{ fontSize: 12 }}>{t2.bank_name ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t2.npci_ref ?? '—'}</td>
                      <td>
                        <span className={`badge ${t2.status === 'SUCCESS' ? 'badge-ok' : 'badge-err'}`}>
                          {t2.status}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 11 }}>{t2.error ?? ''}</td>
                      <td className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {t2.created_at ? new Date(t2.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !ledgerErr ? (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--muted)' }}>
              No DBT transactions recorded yet. Approve an application to see the bank ledger.
            </div>
          ) : (
            <div style={{ padding: '40px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏦</div>
              <p style={{ color: 'var(--muted)', margin: 0 }}>Bank service unavailable and no local transactions found.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
