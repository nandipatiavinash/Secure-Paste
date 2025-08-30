# Overview

SecurePaste is a comprehensive privacy-focused Pastebin alternative with advanced security features including AES-256 encryption, VirusTotal API integration for malware scanning, and detailed access logging. The application supports both anonymous and authenticated usage, with registered users gaining access to dashboard features, settings management, and shareable link creation.

Recent updates include:
- Fixed AES-256-GCM encryption service with proper key derivation
- Added VirusTotal API integration for real-time malware scanning
- Implemented user settings page with encrypted API key storage
- Created shareable links system with expiry and usage limits
- Enhanced security with comprehensive access logging and monitoring
- Added password recovery and forgot password functionality

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Styling**: TailwindCSS with shadcn/ui component library for consistent design
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Authentication**: Context-based auth provider with protected routes

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Password Security**: Node.js crypto module with scrypt for password hashing
- **Middleware**: Custom logging, JSON parsing, and error handling

## Database Architecture
- **Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with migrations support
- **Schema Design**: 
  - Users table for authentication
  - Pastes table with encryption, expiry, and security metadata
  - Access logs for tracking all paste views
  - Password resets for account recovery
  - User settings for VirusTotal API keys and preferences
  - Shareable links for secure paste sharing
- **Connection**: Connection pooling with @neondatabase/serverless

## Security Features
- **Content Scanning**: Regex-based malware detection + VirusTotal API integration
- **Encryption**: AES-256-GCM server-side encryption with PBKDF2 key derivation and secure salt generation
- **API Key Security**: Encrypted storage of VirusTotal API keys using master encryption key
- **Access Control**: Session-based authentication with CSRF protection
- **Logging**: Comprehensive access logging with IP tracking and user agent capture
- **Shareable Links**: Secure token-based sharing with expiry and usage limits
- **Input Validation**: Zod schemas for runtime type checking and validation

## Content Management
- **Paste Features**: Title, language syntax highlighting, expiry dates, view limits
- **Security Scanning**: Automatic malware detection and sensitive data flagging
- **Self-Destruct**: Configurable one-time view or view count limits
- **Encryption**: Optional password-protected encryption for sensitive content

# External Dependencies

## Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL connection and querying
- **drizzle-orm**: Type-safe database ORM with PostgreSQL support
- **drizzle-kit**: Database migration and schema management tools

## Authentication & Security
- **passport**: Authentication middleware with local strategy support
- **bcryptjs**: Password hashing (note: using native crypto for actual implementation)
- **crypto-js**: Client-side encryption utilities
- **express-session**: Session management with PostgreSQL store
- **connect-pg-simple**: PostgreSQL session store adapter

## Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/***: Accessible UI component primitives
- **react-hook-form**: Form handling with validation
- **@hookform/resolvers**: Validation resolvers for react-hook-form
- **wouter**: Lightweight routing library
- **date-fns**: Date manipulation and formatting

## UI & Styling
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant styling
- **clsx**: Conditional class name utility
- **lucide-react**: Icon library

## Development Tools
- **vite**: Fast build tool and development server
- **@vitejs/plugin-react**: React plugin for Vite
- **typescript**: Type safety and development tooling
- **zod**: Runtime type validation and schema definition