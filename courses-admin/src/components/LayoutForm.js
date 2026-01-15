import React, { useState } from 'react';
import HoleForm from './HoleForm';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function LayoutForm({ layout, courseName, courseId, onChange, onRemove }) {
  const [localLayout, setLocalLayout] = useState(layout);

  const updateLayout = (updates) => {
    const updated = { ...localLayout, ...updates };
    setLocalLayout(updated);
    onChange(updated);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'payToPlay') {
      updateLayout({ [name]: value === '' ? null : value });
    } else {
      updateLayout({ [name]: value });
    }
  };

  const addHole = () => {
    const newHole = {
      id: generateUUID(),
      number: (localLayout.latestVersion.holes.length + 1),
      par: 3,
      name: null,
      length: 0,
      measureInMeters: true,
      note: null,
      hasOb: false,
      hasMandatory: false,
      hasHazard: false,
      hasLocalRule: false,
      geolocation: []
    };
    const updatedHoles = [...localLayout.latestVersion.holes, newHole];
    updateLayout({
      latestVersion: {
        ...localLayout.latestVersion,
        holes: updatedHoles
      }
    });
  };

  const updateHole = (index, hole) => {
    const updatedHoles = localLayout.latestVersion.holes.map((h, i) => 
      i === index ? hole : h
    );
    updateLayout({
      latestVersion: {
        ...localLayout.latestVersion,
        holes: updatedHoles
      }
    });
  };

  const removeHole = (index) => {
    const updatedHoles = localLayout.latestVersion.holes.filter((_, i) => i !== index);
    // Renumber holes
    updatedHoles.forEach((hole, i) => {
      hole.number = i + 1;
    });
    updateLayout({
      latestVersion: {
        ...localLayout.latestVersion,
        holes: updatedHoles
      }
    });
  };

  return (
    <div className="layout-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>Layout {localLayout.name || `#${localLayout.id.substring(0, 8)}`}</h3>
        <button type="button" onClick={onRemove} className="btn btn-danger">
          Remove Layout
        </button>
      </div>

      <div className="form-group">
        <label>Layout ID (UUID)</label>
        <input
          type="text"
          value={localLayout.id}
          onChange={(e) => updateLayout({ id: e.target.value })}
          className="form-control"
        />
        <button type="button" onClick={() => updateLayout({ id: generateUUID() })} className="btn btn-secondary">
          Generate New ID
        </button>
      </div>

      <div className="form-group">
        <label>Layout Name *</label>
        <input
          type="text"
          name="name"
          value={localLayout.name}
          onChange={handleInputChange}
          className="form-control"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Type *</label>
          <select
            name="type"
            value={localLayout.type}
            onChange={handleInputChange}
            className="form-control"
            required
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </div>

        <div className="form-group">
          <label>Difficulty *</label>
          <select
            name="difficulty"
            value={localLayout.difficulty}
            onChange={handleInputChange}
            className="form-control"
            required
          >
            <option value="BEGINNER">BEGINNER</option>
            <option value="INTERMEDIATE">INTERMEDIATE</option>
            <option value="ADVANCED">ADVANCED</option>
            <option value="PRO">PRO</option>
          </select>
        </div>

        <div className="form-group">
          <label>Pay to Play</label>
          <input
            type="text"
            name="payToPlay"
            value={localLayout.payToPlay || ''}
            onChange={handleInputChange}
            className="form-control"
            placeholder="Leave empty for null"
          />
        </div>
      </div>

      <div className="subsection">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: 0 }}>Holes</h4>
          <button type="button" onClick={addHole} className="btn">
            Add Hole
          </button>
        </div>

        {localLayout.latestVersion.holes.length === 0 && (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No holes added yet. Click "Add Hole" to add one.</p>
        )}

        {localLayout.latestVersion.holes.map((hole, index) => (
          <HoleForm
            key={hole.id || index}
            hole={hole}
            onChange={(updatedHole) => updateHole(index, updatedHole)}
            onRemove={() => removeHole(index)}
          />
        ))}
      </div>
    </div>
  );
}

export default LayoutForm;

