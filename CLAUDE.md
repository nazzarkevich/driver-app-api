# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `yarn install` - Install dependencies
- `yarn start:dev` - Start development server with hot reload (port 3000)
- `yarn start:prod` - Start production server
- `yarn build` - Build the application for production

### Testing
- `yarn test` - Run unit tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:cov` - Run tests with coverage report
- `yarn test:e2e` - Run end-to-end tests

### Code Quality
- `yarn lint` - Run ESLint to check and fix code style issues
- `yarn format` - Format code using Prettier

### Database Management
- `npx prisma generate` - Generate Prisma client
- `npx prisma migrate dev` - Run database migrations in development
- `npx prisma db push` - Push schema changes to database
- `yarn seed:dev` - Seed development database
- `yarn seed:prod` - Seed production database

## Architecture Overview

### Technology Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth integration
- **API Documentation**: Swagger/OpenAPI (available at `/api`)

### Core Architecture Patterns

#### Multi-Tenant Architecture
The application implements a multi-tenant architecture where:
- Each `Business` is a separate tenant
- All entities are scoped to a specific `businessId`
- `BaseTenantService` provides common tenant isolation logic
- SuperAdmin users can access data across all businesses
- New users are automatically assigned to the default business (UALogistics, ID: 1)
- Default business can be configured via `DEFAULT_BUSINESS_ID` environment variable

#### Authentication & Authorization
- Supabase-based authentication with OAuth support
- Role-based access control with guards:
  - `SupabaseAuthGuard` - Ensures user is authenticated via Supabase
  - `SuperAdminGuard` - Restricts access to super admins
  - `BusinessAdminGuard` - Restricts access to business admins
  - `RolesGuard` - Handles role-based permissions
- Public routes use `@Public()` decorator

#### Audit Logging
- `AuditInterceptor` automatically logs all data modifications
- Tracks user actions, timestamps, and changed data
- Use `@AuditLog()` decorator to enable/disable audit logging per endpoint

### Key Domain Models

1. **User Management**
   - Users belong to a specific Business
   - User types: Member, Admin, SuperAdmin
   - Profiles: Driver, Courier, Customer

2. **Logistics Operations**
   - **Parcels**: Core shipment entities with tracking
   - **Journeys**: International routes for drivers
   - **CourierJourneys**: Local delivery routes
   - **Vehicles**: Fleet management
   - **Addresses**: Multi-country address support

3. **Business Structure**
   - Each Business is isolated
   - Users, parcels, vehicles, etc. are scoped to their Business
   - SuperAdmins can manage multiple businesses

### Service Layer Patterns

All services extend `BaseTenantService` which provides:
- `validateBusinessAccess()` - Ensures user can access the business
- `getBusinessFilter()` - Returns appropriate filter based on user permissions
- `getBusinessWhere()` - Builds WHERE clause with business isolation

### API Response Format
- DTOs use class-validator for input validation
- Responses are serialized using class-transformer
- Pagination is handled via `PaginationDto`
- Errors follow consistent format via `HttpExceptionFilter`

### Security Considerations
- All endpoints require authentication by default
- Business isolation is enforced at the service layer
- Sensitive data is excluded from responses via DTOs
- Input validation on all endpoints
- CORS and other security headers configured

### Development Workflow
1. Create/modify Prisma schema
2. Run migrations: `npx prisma migrate dev`
3. Generate client: `npx prisma generate`
4. Implement service extending `BaseTenantService`
5. Create DTOs with proper validation
6. Implement controller with appropriate guards
7. Test endpoints via Swagger UI at `/api`