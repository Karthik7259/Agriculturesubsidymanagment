import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
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
};

type Txn = {
  txn_id: string;
  farmer_id: string;
  amount: number;
  status: string;
  error?: string;
  bank_name?: string;
  npci_ref?: string;
  created_at: string;
};

export default function AdminDemoData() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/demo/admin/parcels'),
      api.get('/demo/admin/ledger'),
    ]).then(([a, b]) => {
      setParcels(a.data);
      setTxns(b.data);
    }).catch((ex) => setErr(ex?.response?.data?.detail ?? 'Load failed'));
  }, []);

  const center: [number, number] = parcels.length
    ? [parcels[0].polygon.coordinates[0][0][1], parcels[0].polygon.coordinates[0][0][0]]
    : [19.0, 75.0];

  return (
    <div className="container">
      <div className="card">
        <h2>Demo data</h2>
        <p className="muted">
          Pre-seeded cadastral registry and bank ledger. These power the realistic
          responses you see during verification — they are not mocks that return
          empty / stub data, they are a working synthetic dataset.
        </p>
      </div>

      {err && <div className="card error">{err}</div>}

      <div className="card">
        <h3>Cadastral registry — {parcels.length} parcels</h3>
        <MapContainer center={center} zoom={6} style={{ height: 450, borderRadius: 8 }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {parcels.map((p) => {
            const coords = p.polygon.coordinates[0].map(
              ([lng, lat]) => [lat, lng] as [number, number],
            );
            return (
              <Polygon key={p.parcel_id} positions={coords} pathOptions={{ color: '#22c55e', weight: 2 }}>
                <Tooltip>
                  <b>{p.parcel_id}</b><br />
                  {p.owner_name}<br />
                  {p.total_hectares.toFixed(2)} ha · {p.soil_type}<br />
                  {p.taluka}, {p.district}
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>
      </div>

      <div className="card">
        <h3>Bank ledger — last {txns.length} transactions</h3>
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Farmer</th>
              <th>Amount</th>
              <th>Bank</th>
              <th>NPCI ref</th>
              <th>Status</th>
              <th>Error</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.txn_id}>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.txn_id}</td>
                <td>{t.farmer_id}</td>
                <td>₹{t.amount.toLocaleString()}</td>
                <td>{t.bank_name ?? '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.npci_ref ?? '—'}</td>
                <td>
                  <span className={`badge ${t.status === 'SUCCESS' ? 'badge-ok' : 'badge-err'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="muted">{t.error ?? ''}</td>
                <td className="muted">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
