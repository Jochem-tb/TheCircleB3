# TheCircleB3
# **The Circle** is a livestreaming platform where “transparent persons” voluntarily share their lives via mobile SeeChange cameras. Followers can watch, interact, and respond in real time. This repository implements a secure, modular streaming infrastructure with chat functionality, session tracking, and full transparency.

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
