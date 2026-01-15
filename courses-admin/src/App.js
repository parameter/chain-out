import React from 'react';
import CourseForm from './components/CourseForm';
import './index.css';

function App() {
  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <h1>Courses Admin - Create New Course</h1>
        </div>
      </header>
      <div className="container">
        <CourseForm />
      </div>
    </div>
  );
}

export default App;

