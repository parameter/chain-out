import React, { useState } from 'react';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function HoleForm({ hole, onChange, onRemove }) {
  const [localHole, setLocalHole] = useState(hole);

  const updateHole = (updates) => {
    const updated = { ...localHole, ...updates };
    setLocalHole(updated);
    onChange(updated);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      updateHole({ [name]: checked });
    } else if (type === 'number') {
      updateHole({ [name]: value === '' ? null : parseFloat(value) });
    } else {
      updateHole({ [name]: value === '' ? null : value });
    }
  };

  const addGeolocationPoint = () => {
    const newPoint = { lat: '', lng: '' };
    updateHole({
      geolocation: [...(localHole.geolocation || []), newPoint]
    });
  };

  const updateGeolocationPoint = (index, point) => {
    const updated = localHole.geolocation.map((p, i) => 
      i === index ? point : p
    );
    updateHole({ geolocation: updated });
  };

  const removeGeolocationPoint = (index) => {
    const updated = localHole.geolocation.filter((_, i) => i !== index);
    updateHole({ geolocation: updated });
  };

  return (
    <div className="hole-item">
      <div className="hole-header">
        <span className="hole-number">Hole {localHole.number}</span>
        <button type="button" onClick={onRemove} className="btn btn-danger">
          Remove Hole
        </button>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Hole ID (UUID)</label>
          <input
            type="text"
            value={localHole.id}
            onChange={(e) => updateHole({ id: e.target.value })}
            className="form-control"
          />
          <button type="button" onClick={() => updateHole({ id: generateUUID() })} className="btn btn-secondary">
            Generate New ID
          </button>
        </div>

        <div className="form-group">
          <label>Number *</label>
          <input
            type="number"
            name="number"
            value={localHole.number}
            onChange={handleInputChange}
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label>Par *</label>
          <input
            type="number"
            name="par"
            value={localHole.par}
            onChange={handleInputChange}
            className="form-control"
            required
            min="2"
            max="7"
          />
        </div>

        <div className="form-group">
          <label>Length *</label>
          <input
            type="number"
            name="length"
            value={localHole.length}
            onChange={handleInputChange}
            className="form-control"
            required
            min="0"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            name="name"
            value={localHole.name || ''}
            onChange={handleInputChange}
            className="form-control"
            placeholder="Leave empty for null"
          />
        </div>

        <div className="form-group">
          <label>Note</label>
          <textarea
            name="note"
            value={localHole.note || ''}
            onChange={handleInputChange}
            className="form-control"
            rows="3"
            placeholder="Leave empty for null"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="checkbox-group">
          <input
            type="checkbox"
            name="measureInMeters"
            checked={localHole.measureInMeters}
            onChange={handleInputChange}
          />
          <label>Measure in Meters</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            name="hasOb"
            checked={localHole.hasOb}
            onChange={handleInputChange}
          />
          <label>Has OB</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            name="hasMandatory"
            checked={localHole.hasMandatory}
            onChange={handleInputChange}
          />
          <label>Has Mandatory</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            name="hasHazard"
            checked={localHole.hasHazard}
            onChange={handleInputChange}
          />
          <label>Has Hazard</label>
        </div>

        <div className="checkbox-group">
          <input
            type="checkbox"
            name="hasLocalRule"
            checked={localHole.hasLocalRule}
            onChange={handleInputChange}
          />
          <label>Has Local Rule</label>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '15px' }}>
        <label>
          Geolocation Points
          <button type="button" onClick={addGeolocationPoint} className="btn" style={{ marginLeft: '10px' }}>
            Add Point
          </button>
        </label>

        {(!localHole.geolocation || localHole.geolocation.length === 0) && (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No geolocation points added yet.</p>
        )}

        <div className="geolocation-points">
          {localHole.geolocation && localHole.geolocation.map((point, index) => (
            <div key={index} className="geolocation-point">
              <div className="geolocation-input">
                <label>Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={point.lat || ''}
                  onChange={(e) => {
                    const updated = { ...point, lat: e.target.value ? parseFloat(e.target.value) : '' };
                    updateGeolocationPoint(index, updated);
                  }}
                  className="form-control"
                />
              </div>
              <div className="geolocation-input">
                <label>Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={point.lng || ''}
                  onChange={(e) => {
                    const updated = { ...point, lng: e.target.value ? parseFloat(e.target.value) : '' };
                    updateGeolocationPoint(index, updated);
                  }}
                  className="form-control"
                />
              </div>
              <button
                type="button"
                onClick={() => removeGeolocationPoint(index)}
                className="btn btn-danger"
                style={{ alignSelf: 'flex-end' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HoleForm;

