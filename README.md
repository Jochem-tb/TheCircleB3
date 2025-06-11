# TheCircleB3
**The Circle** is a livestreaming platform where “transparent persons” voluntarily share their lives via mobile SeeChange cameras. Followers can watch, interact, and respond in real time. This repository implements a secure, modular streaming infrastructure with chat functionality, session tracking, and full transparency.

## Project Goals

- Allow **followers** to view multiple transparent persons live.
- Provide **transparent persons** with an easy way to broadcast their lives via mobile.
- Enable **real-time communication** between followers and streamers.
- Enforce **identity and logging** via the TruYou system.
- Ensure **data integrity** while forbidding encryption or anonymity.

## Tech Stack

| Component           | Technology Used                     |
|--------------------|--------------------------------------|
| Frontend           | Angular? (Monorepo)     |
| Chat Server        | Node.js + WebSocket                  |
| Ingest Server      | ?                |
| Streaming Server   | ?                         |
| Authentication     | TruYou service (JWT, no anonymity)   |
| Logging            | Custom event logger (file/database)  |

## DoD highlights:

- No encrypted data; transparency is mandatory.
- Data integrity must be guaranteed (e.g., digital signatures).
- All data must be logged and never deleted.
- Only open standards (e.g., RTMP, HLS, WebSocket, JWT).
- All source code must be in English and versioned with Git.
- The 4+1 architectural model must be documented (→ see `/docs`).

## Project Setup & Running Guide

# Prerequisites

Before you begin, make sure you have the following installed on your system:

- **[Node.js](https://nodejs.org/)** (version 16.x or higher recommended)  
  Node.js comes with npm, which is required to install project dependencies.

# Getting Started
- 1. Clone the Repository
git clone https://github.com/Jochem-tb/TheCircleB3.git
cd TheCircleB3
- 2. Navigate to the Frontend Folder
cd frontend
- 3. Install Dependencies
npm install
- 4. Run the Project
cd projects
cd [ProjectName]
ng serve

# Note: If you don’t have the Angular CLI installed globally, you can install it using:
npm install -g @angular/cli
