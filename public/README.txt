Simple MSN-style local chat app.

To run:
  1. Ensure Node.js is installed.
  2. In the project folder run:
     npm install
     npm start
  3. Open http://localhost:3000 in your browser.

Features:
  - Join without registration (optional name, age, country).
  - Three room buttons (Chat 1 / Chat 2 / Chat 3).
  - Public room messages per selected room.
  - Click any online user to open a private chat window.
  - Private chat supports sending images (uses base64 transfer).

Notes:
  - This is a demo implementation and stores all data in memory (not persistent).
  - For production use: add sanitization, rate-limiting, file upload to disk or cloud, authentication, and storage (DB).
