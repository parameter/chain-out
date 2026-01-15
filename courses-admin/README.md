# Courses Admin

A React admin interface for creating and inserting new courses into the coursesCollection.

## Setup

1. Install dependencies:
```bash
cd courses-admin
npm install
```

2. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000` (or the next available port).

## Usage

1. Fill in the course information:
   - Course ID (UUID) - auto-generated, can be regenerated
   - Course Name (required)
   - Address (required)
   - Type (PUBLIC or PRIVATE)
   - Geolocation: Longitude and Latitude (required)

2. Add Layouts:
   - Click "Add Layout" to add a new layout
   - Fill in layout details:
     - Layout ID (UUID)
     - Layout Name (required)
     - Type (PUBLIC or PRIVATE)
     - Difficulty (BEGINNER, INTERMEDIATE, ADVANCED, PRO)
     - Pay to Play (optional)

3. Add Holes to each Layout:
   - Click "Add Hole" within a layout
   - Fill in hole details:
     - Hole ID (UUID)
     - Number (required)
     - Par (required, 2-7)
     - Length (required)
     - Name (optional)
     - Note (optional)
     - Checkboxes for: Measure in Meters, Has OB, Has Mandatory, Has Hazard, Has Local Rule
   - Add Geolocation Points for each hole (latitude and longitude pairs)

4. Submit:
   - Click "Create Course" to insert the course into the database

## API Endpoint

The form submits to: `POST /admin/api/courses`

The backend endpoint validates the data and inserts it into the MongoDB `courses` collection.

