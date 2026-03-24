# ARISE Architecture & System Design

## Core Architecture Pattern
Microservices-lite Architecture with separated responsibilities:
- **Frontend Layer:** Client-side rendered React SPA handling all presentation, 3D/Canvas simulations, and client-side routing.
- **API Gateway/Main Backend:** Node.js + Express handling all core CRUD operations, authentication proxy validation, business logic, and web sockets.
- **ML Processing Layer:** Python FastAPI stateless microservice to handle compute-heavy model evaluations (scikit-learn, isolation forests) over HTTP calls from the Main Backend.

## Data Flow
Client <-> Node Server (REST/WebSockets) <-> DB (PostgreSQL)
Node Server <-> Python ML Service (REST)

## Stack Selection
- React 18 / Vite / Zustand / GSAP
- Node.js / Express
- Python / FastAPI
- Supabase (PostgreSQL for both relational data and unstructured JSONB data)

## Database Architecture Decision: PostgreSQL JSONB vs MongoDB
We decided to drop MongoDB and exclusively use PostgreSQL (via Supabase) utilizing its powerful `JSONB` column type for unstructured data such as lab logs, journal entries, and proctoring event timelines.
**Reasoning:**
- **Simplified Infrastructure:** Reduces the tech stack from two databases to one, meaning less mental overhead, fewer connection pools to manage, and simpler deployment.
- **JSONB Capabilities:** PostgreSQL's JSONB is highly optimized, allowing for indexing and deep querying of unstructured JSON documents, providing NoSQL-like flexibility without sacrificing ACID compliance.
- **Unified Ecosystem:** Keeping all data in Supabase allows us to leverage its built-in Auth and real-time features seamlessly across all entities.
