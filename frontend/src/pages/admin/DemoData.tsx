import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    }).catch((ex) => setErr(ex?.response?.data?.detail ?? t('admin.queue.loadFailed')));
  }, [t]);

  const center: [number, number] = parcels.length
    ? [parcels[0].polygon.coordinates[0][0][1], parcels[0].polygon.coordinates[0][0][0]]
    : [19.0, 75.0];

  return (
    <div className="container">
      <div className="card">
        <h2>{t('admin.demo.title')}</h2>
        <p className="muted">{t('admin.demo.caption')}</p>
      </div>

      {err && <div className="card error">{err}</div>}

      <div className="card">
        <h3>{t('admin.demo.cadastralTitle')} {parcels.length} {t('admin.demo.parcels')}</h3>
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
        <h3>{t('admin.demo.ledgerTitle')} {txns.length} {t('admin.demo.transactions')}</h3>
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>{t('admin.demo.cols.txnId')}</th>
              <th>{t('admin.demo.cols.farmer')}</th>
              <th>{t('admin.demo.cols.amount')}</th>
              <th>{t('admin.demo.cols.bank')}</th>
              <th>{t('admin.demo.cols.npciRef')}</th>
              <th>{t('admin.demo.cols.status')}</th>
              <th>{t('admin.demo.cols.error')}</th>
              <th>{t('admin.demo.cols.when')}</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t2) => (
              <tr key={t2.txn_id}>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t2.txn_id}</td>
                <td>{t2.farmer_id}</td>
                <td>₹{t2.amount.toLocaleString()}</td>
                <td>{t2.bank_name ?? '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{t2.npci_ref ?? '—'}</td>
                <td>
                  <span className={`badge ${t2.status === 'SUCCESS' ? 'badge-ok' : 'badge-err'}`}>
                    {t2.status}
                  </span>
                </td>
                <td className="muted">{t2.error ?? ''}</td>
                <td className="muted">{new Date(t2.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
