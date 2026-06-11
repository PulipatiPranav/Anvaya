import React, { useEffect, useState } from "react";
import axios from "axios";
import "./SuperAdminDashboard.css";

import { API_BASE } from '../config/api';
const SuperAdminDashboard = () => {
  const [therapists, setTherapists] = useState([]);
  const [form, setForm] = useState({ therapistId: '', name: '', username: '', password: '' });
  const [showForm, setShowForm] = useState(false);

  const fetchTherapists = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/superadmin/therapists-with-children`);
      setTherapists(res.data);
    } catch (error) {
      console.error("Error fetching therapists:", error);
    }
  };

  useEffect(() => {
    fetchTherapists();
  }, []);

  const handleAddTherapist = async () => {
    try {
      await axios.post(`${API_BASE}/api/superadmin/therapists`, form);
      setForm({ therapistId: '', name: '', username: '', password: '' });
      setShowForm(false);
      fetchTherapists();
    } catch (error) {
      console.error("Error adding therapist:", error);
    }
  };

  return (
    <div className="superadmin-dashboard-container">
      <h2 className="superadmin-dashboard-title">SuperAdmin Dashboard</h2>

      {!showForm && (
        <button className="superadmin-form-button" onClick={() => setShowForm(true)}>
          Add Therapist
        </button>
      )}

      {showForm && (
        <div className="superadmin-form-container">
          <input
            className="superadmin-form-input"
            placeholder="Therapist ID"
            value={form.therapistId}
            onChange={(e) => setForm({ ...form, therapistId: e.target.value })}
          />
          <input
            className="superadmin-form-input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="superadmin-form-input"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="superadmin-form-input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <div className="superadmin-form-button-group">
            <button className="superadmin-form-button" onClick={handleAddTherapist}>
              Submit
            </button>
            <button className="superadmin-form-button cancel" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <h3 className="superadmin-section-title">All Therapists and Their Children</h3>

      <table className="superadmin-table">
        <thead>
          <tr>
            <th>Therapist ID</th>
            <th>Name</th>
            <th>Username</th>
            <th>Children</th>
          </tr>
        </thead>
        <tbody>
          {therapists.length > 0 ? (
            therapists.map((entry) => (
              <tr key={entry.therapist.therapistId}>
                <td>{entry.therapist.therapistId}</td>
                <td>{entry.therapist.name}</td>
                <td>{entry.therapist.username}</td>
                <td>
                  {entry.children.length > 0 ? (
                    <ul className="superadmin-child-list">
                      {entry.children.map((child) => (
                        <li key={child._id}>
                          {child.name} ({child.username})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <em>No child registered</em>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" style={{ textAlign: "center" }}>
                No therapists found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SuperAdminDashboard;
