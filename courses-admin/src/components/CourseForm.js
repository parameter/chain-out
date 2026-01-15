import React, { useState } from 'react';
import axios from 'axios';
import LayoutForm from './LayoutForm';

// Configure axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function CourseForm() {
  const [formData, setFormData] = useState({
    id: generateUUID(),
    name: '',
    address: '',
    type: 'PUBLIC',
    layouts: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addLayout = () => {
    const newLayout = {
      type: 'PUBLIC',
      id: generateUUID(),
      name: '',
      difficulty: 'INTERMEDIATE',
      payToPlay: null,
      course: {
        name: formData.name || '',
        id: formData.id
      },
      latestVersion: {
        id: generateUUID(),
        createdAt: new Date().toISOString(),
        holes: []
      }
    };
    setFormData(prev => ({
      ...prev,
      layouts: [...prev.layouts, newLayout]
    }));
  };

  const updateLayout = (index, layout) => {
    setFormData(prev => ({
      ...prev,
      layouts: prev.layouts.map((l, i) => i === index ? layout : l)
    }));
  };

  const removeLayout = (index) => {
    setFormData(prev => ({
      ...prev,
      layouts: prev.layouts.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!formData.name || !formData.name.trim()) {
      return 'Course name is required';
    }
    if (!formData.address || !formData.address.trim()) {
      return 'Address is required';
    }
    if (formData.layouts.length === 0) {
      return 'At least one layout is required';
    }
    for (let i = 0; i < formData.layouts.length; i++) {
      const layout = formData.layouts[i];
      if (!layout.name || !layout.name.trim()) {
        return `Layout ${i + 1}: Name is required`;
      }
      if (!layout.latestVersion || !layout.latestVersion.holes || layout.latestVersion.holes.length === 0) {
        return `Layout ${i + 1}: At least one hole is required`;
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Prepare the course object
      const courseData = {
        id: formData.id,
        name: formData.name,
        address: formData.address,
        type: formData.type,
        layouts: formData.layouts.map(layout => ({
          ...layout,
          course: {
            name: formData.name,
            id: formData.id
          }
        }))
      };

      const response = await axios.post('/admin/api/courses', courseData);
      
      setSuccess(`Course created successfully! ID: ${response.data.course._id}`);
      
      // Reset form
      setFormData({
        id: generateUUID(),
        name: '',
        address: '',
        type: 'PUBLIC',
        layouts: []
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="section">
          <div className="section-title">Course Information</div>
          
          <div className="form-group">
            <label>Course ID (UUID)</label>
            <input
              type="text"
              name="id"
              value={formData.id}
              onChange={handleInputChange}
              className="form-control"
              required
            />
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, id: generateUUID() }))} className="btn btn-secondary">
              Generate New ID
            </button>
          </div>

          <div className="form-group">
            <label>Course Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>Address *</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="form-control"
              required
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </div>
        </div>

        <div className="section">
          <div className="section-title">
            Layouts
            <button type="button" onClick={addLayout} className="btn" style={{ float: 'right' }}>
              Add Layout
            </button>
          </div>

          {formData.layouts.length === 0 && (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No layouts added yet. Click "Add Layout" to add one.</p>
          )}

          {formData.layouts.map((layout, index) => (
            <LayoutForm
              key={index}
              layout={layout}
              courseName={formData.name}
              courseId={formData.id}
              onChange={(updatedLayout) => updateLayout(index, updatedLayout)}
              onRemove={() => removeLayout(index)}
            />
          ))}
        </div>

        <div style={{ marginTop: '30px' }}>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CourseForm;

