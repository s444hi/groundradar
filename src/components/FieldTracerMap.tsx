import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { Search, MapPin, CheckCircle2, Trash2 } from 'lucide-react';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export interface TracedFieldData {
  latitude: number;
  longitude: number;
  area_acres: number;
  geoJson: GeoJSON.FeatureCollection;
}

interface FieldTracerMapProps {
  onFieldConfirm: (fieldData: TracedFieldData) => void;
}

export const FieldTracerMap: React.FC<FieldTracerMapProps> = ({ onFieldConfirm }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [tracedData, setTracedData] = useState<TracedFieldData | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-98.5795, 39.8283], // Default US center before user searches
      zoom: 4,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
    });

    map.addControl(draw, 'top-right');
    mapRef.current = map;
    drawRef.current = draw;

    const recalculateField = () => {
      const data = draw.getAll();
      if (data.features.length > 0) {
        // Keep only the latest traced polygon so there's 1 clear field
        if (data.features.length > 1) {
          const oldestId = data.features[0].id;
          if (oldestId) draw.delete(String(oldestId));
        }

        const latestData = draw.getAll();
        const sqMeters = turf.area(latestData);
        const acres = Number((sqMeters * 0.000247105).toFixed(2));
        const centroid = turf.centroid(latestData);
        const [lng, lat] = centroid.geometry.coordinates;

        setTracedData({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          area_acres: acres,
          geoJson: latestData,
        });
      } else {
        setTracedData(null);
      }
    };

    map.on('draw.create', recalculateField);
    map.on('draw.update', recalculateField);
    map.on('draw.delete', recalculateField);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapRef.current) return;

    setSearching(true);
    try {
      const token = mapboxgl.accessToken;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${token}&limit=1`
      );
      const json = await res.json();
      if (json.features && json.features.length > 0) {
        const [lng, lat] = json.features[0].center;
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16,
          essential: true,
        });
        // Activate polygon drawing immediately after flying to their farm/garden
        drawRef.current?.changeMode('draw_polygon');
      }
    } catch (err) {
      console.error('Location search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleClearPolygon = () => {
    drawRef.current?.deleteAll();
    drawRef.current?.changeMode('draw_polygon');
    setTracedData(null);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Top Header & Location Search */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '28px',
              fontWeight: 400,
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            1. Locate & Trace Your Field
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              color: 'var(--color-text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Search your address or coordinates, then click points on the map to outline your plot (double-click to finish).
          </p>
        </div>

        <form onSubmit={handleLocationSearch} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter town, address, or lat, lng..."
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                padding: '10px 16px 10px 38px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                color: 'var(--color-text)',
                width: '280px',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 500,
              padding: '10px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--color-olive)',
              color: 'var(--color-text-on-dark)',
              cursor: 'pointer',
            }}
          >
            {searching ? 'Locating...' : 'Find Location'}
          </button>
        </form>
      </div>

      {/* Interactive Mapbox Canvas */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '460px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      />

      {/* Bottom Readout Bar & Proceed Button */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginTop: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--color-cream)',
          borderRadius: '16px',
        }}
      >
        {tracedData ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} style={{ color: 'var(--color-olive)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text)' }}>
                {tracedData.latitude}°, {tracedData.longitude}°
              </span>
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Traced Area:{' '}
              </span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', color: 'var(--color-olive)' }}>
                {tracedData.area_acres} acres
              </strong>
            </div>
          </div>
        ) : (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--color-text-muted)' }}>
            Click on the satellite map to place your first boundary corner.
          </span>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          {tracedData && (
            <button
              type="button"
              onClick={handleClearPolygon}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={15} />
              Redraw
            </button>
          )}

          <button
            type="button"
            disabled={!tracedData}
            onClick={() => tracedData && onFieldConfirm(tracedData)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 500,
              padding: '10px 24px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: tracedData ? 'var(--color-olive)' : 'var(--color-border)',
              color: tracedData ? 'var(--color-text-on-dark)' : 'var(--color-text-muted)',
              cursor: tracedData ? 'pointer' : 'not-allowed',
            }}
          >
            <CheckCircle2 size={16} />
            Confirm Area & Continue
          </button>
        </div>
      </div>
    </div>
  );
};